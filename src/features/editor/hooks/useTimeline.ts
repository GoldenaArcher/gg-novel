import { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { projectBridge } from '../../../services/ipcClient'
import { useEditorStore } from '../../../stores/editorStore'

interface UseTimelineOptions {
  projectId?: string
  chapterId?: string
  managerOpen: boolean
}

export const useTimeline = ({ projectId, chapterId, managerOpen }: UseTimelineOptions) => {
  const {
    timelineEntries,
    selectedSnapshot,
    snapshotPreview,
    openTimeline,
    closeTimeline,
    resetTimelineData,
    setTimelineEntries,
    setTimelineLoading,
    setSelectedSnapshot,
    setSnapshotPreview,
    setSnapshotPreviewLoading,
    setDeletingSnapshot,
    setDraftText
  } = useEditorStore(
    useShallow((state) => ({
      timelineEntries: state.timelineEntries,
      selectedSnapshot: state.selectedSnapshot,
      snapshotPreview: state.snapshotPreview,
      openTimeline: state.openTimeline,
      closeTimeline: state.closeTimeline,
      resetTimelineData: state.resetTimelineData,
      setTimelineEntries: state.setTimelineEntries,
      setTimelineLoading: state.setTimelineLoading,
      setSelectedSnapshot: state.setSelectedSnapshot,
      setSnapshotPreview: state.setSnapshotPreview,
      setSnapshotPreviewLoading: state.setSnapshotPreviewLoading,
      setDeletingSnapshot: state.setDeletingSnapshot,
      setDraftText: state.setDraftText
    }))
  )

  const handleSelectSnapshot = useCallback(
    async (timestamp: number) => {
      if (!projectId || !chapterId) return
      setSelectedSnapshot(timestamp)
      setSnapshotPreviewLoading(true)
      try {
        const content = await projectBridge.readSnapshot(projectId, chapterId, timestamp)
        setSnapshotPreview(content ?? null)
      } catch (error) {
        console.error('Failed to read snapshot', error)
        setSnapshotPreview(null)
      } finally {
        setSnapshotPreviewLoading(false)
      }
    },
    [projectId, chapterId, setSelectedSnapshot, setSnapshotPreview, setSnapshotPreviewLoading]
  )

  const loadSnapshots = useCallback(
    async (options?: { selectFirst?: boolean }) => {
      if (!projectId || !chapterId) {
        setTimelineEntries([])
        setSelectedSnapshot(null)
        setSnapshotPreview(null)
        return []
      }
      setTimelineLoading(true)
      try {
        const entries = await projectBridge.listSnapshots(projectId, chapterId)
        setTimelineEntries(entries)
        if (entries.length === 0) {
          setSelectedSnapshot(null)
          setSnapshotPreview(null)
        } else if (options?.selectFirst) {
          await handleSelectSnapshot(entries[0].timestamp)
        }
        return entries
      } catch (error) {
        console.error('Failed to load snapshots', error)
        setTimelineEntries([])
        setSelectedSnapshot(null)
        setSnapshotPreview(null)
        return []
      } finally {
        setTimelineLoading(false)
      }
    },
    [
      projectId,
      chapterId,
      handleSelectSnapshot,
      setTimelineEntries,
      setSelectedSnapshot,
      setSnapshotPreview,
      setTimelineLoading
    ]
  )

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  useEffect(() => {
    closeTimeline()
    resetTimelineData()
  }, [chapterId, closeTimeline, resetTimelineData])

  useEffect(() => {
    if (managerOpen) {
      closeTimeline()
    }
  }, [managerOpen, closeTimeline])

  const openTimelineWithData = useCallback(async () => {
    if (!projectId || !chapterId) return
    openTimeline()
    if (timelineEntries.length === 0) {
      await loadSnapshots({ selectFirst: true })
    } else if (!selectedSnapshot && timelineEntries.length > 0) {
      await handleSelectSnapshot(timelineEntries[0].timestamp)
    }
  }, [
    projectId,
    chapterId,
    openTimeline,
    timelineEntries,
    loadSnapshots,
    selectedSnapshot,
    handleSelectSnapshot
  ])

  const handleRestoreSnapshot = useCallback(() => {
    if (!snapshotPreview) return
    setDraftText(snapshotPreview)
    closeTimeline()
  }, [snapshotPreview, setDraftText, closeTimeline])

  const handleDeleteSnapshot = useCallback(
    async (timestamp: number) => {
      if (!projectId || !chapterId) return
      setDeletingSnapshot(timestamp)
      try {
        await projectBridge.deleteSnapshot(projectId, chapterId, timestamp)
        await loadSnapshots({ selectFirst: true })
      } catch (error) {
        console.error('Failed to delete snapshot', error)
      } finally {
        setDeletingSnapshot(null)
      }
    },
    [projectId, chapterId, loadSnapshots, setDeletingSnapshot]
  )

  return {
    openTimeline: openTimelineWithData,
    handleSelectSnapshot,
    handleRestoreSnapshot,
    handleDeleteSnapshot
  }
}

