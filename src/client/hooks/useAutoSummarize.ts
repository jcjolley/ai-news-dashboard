import { useEffect, useRef, useState, useCallback } from 'react'
import { Article } from './useNews'

interface AutoSummarizeState {
  isAutoSummarizing: boolean
  currentArticleId: string | null
  progress: { current: number; total: number }
}

export function useAutoSummarize(
  articles: Article[],
  summarize: (id: string) => Promise<string | null>
) {
  const [state, setState] = useState<AutoSummarizeState>({
    isAutoSummarizing: false,
    currentArticleId: null,
    progress: { current: 0, total: 0 }
  })

  const elementRefs = useRef<Map<string, HTMLElement>>(new Map())
  const visibleIds = useRef<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const processingRef = useRef(false)
  const abortRef = useRef(false)

  const registerRef = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      elementRefs.current.set(id, element)
      observerRef.current?.observe(element)
    } else {
      const existing = elementRefs.current.get(id)
      if (existing) {
        observerRef.current?.unobserve(existing)
      }
      elementRefs.current.delete(id)
      visibleIds.current.delete(id)
    }
  }, [])

  const processQueue = useCallback(async () => {
    if (processingRef.current || abortRef.current) return

    const unsummarizedVisible = articles.filter(
      a => visibleIds.current.has(a.id) && !a.summary && a.content
    )

    if (unsummarizedVisible.length === 0) {
      setState(prev => ({
        ...prev,
        isAutoSummarizing: false,
        currentArticleId: null,
        progress: { current: 0, total: 0 }
      }))
      return
    }

    processingRef.current = true
    const total = unsummarizedVisible.length
    let current = 0

    setState(prev => ({
      ...prev,
      isAutoSummarizing: true,
      progress: { current: 0, total }
    }))

    for (const article of unsummarizedVisible) {
      if (abortRef.current) break
      if (article.summary) continue

      setState(prev => ({
        ...prev,
        currentArticleId: article.id,
        progress: { current, total }
      }))

      try {
        await summarize(article.id)
      } catch (err) {
        console.error(`Failed to auto-summarize article ${article.id}:`, err)
      }

      current++
      setState(prev => ({
        ...prev,
        progress: { current, total }
      }))
    }

    processingRef.current = false
    setState(prev => ({
      ...prev,
      isAutoSummarizing: false,
      currentArticleId: null
    }))
  }, [articles, summarize])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = entry.target.getAttribute('data-article-id')
          if (!id) return

          if (entry.isIntersecting) {
            visibleIds.current.add(id)
          } else {
            visibleIds.current.delete(id)
          }
        })

        if (!processingRef.current) {
          processQueue()
        }
      },
      { threshold: 0.1 }
    )

    elementRefs.current.forEach((element) => {
      observerRef.current?.observe(element)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [processQueue])

  useEffect(() => {
    abortRef.current = false
    processingRef.current = false
    // Don't clear visibleIds - the IntersectionObserver keeps it up-to-date
    // and registerRef handles cleanup when elements unmount.
    // Clearing here causes a race condition where visible articles are forgotten.

    elementRefs.current.forEach((element) => {
      observerRef.current?.observe(element)
    })

    const timer = setTimeout(() => {
      processQueue()
    }, 500)

    return () => {
      clearTimeout(timer)
      abortRef.current = true
    }
  }, [articles, processQueue])

  return {
    registerRef,
    isAutoSummarizing: state.isAutoSummarizing,
    currentArticleId: state.currentArticleId,
    progress: state.progress
  }
}
