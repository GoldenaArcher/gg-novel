import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalPortalProps {
  children: ReactNode
}

let modalCount = 0

export const ModalPortal = ({ children }: ModalPortalProps) => {
  const [container, setContainer] = useState<Element | null>(null)

  useEffect(() => {
    const root = document.getElementById('modal-root')
    setContainer(root)
  }, [])

  useEffect(() => {
    if (!container) return
    modalCount += 1
    if (modalCount === 1) {
      document.body.classList.add('modal-open')
    }
    return () => {
      modalCount = Math.max(0, modalCount - 1)
      if (modalCount === 0) {
        document.body.classList.remove('modal-open')
      }
    }
  }, [container])

  if (!container) return null
  return createPortal(children, container)
}

export default ModalPortal
