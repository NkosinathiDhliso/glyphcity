import {
  ANDROID_ABSOLUTE_HEADING_ACCURACY_DEG,
  circularMean,
  compassHeadingFromEuler,
  pushHeadingSample,
  type HeadingSample,
} from '@area-code/shared/lib/pointMode/heading'
import { useCallback, useEffect, useRef, useState } from 'react'

export type PointModeStatus =
  | 'idle'
  | 'starting'
  | 'live'
  | 'paused'
  | 'unsupported'
  | 'camera-denied'
  | 'location-denied'
  | 'motion-denied'

export interface PointModePosition {
  lat: number
  lng: number
  accuracyMetres: number
}

export interface PointModeHeading {
  deg: number
  /** Null when the device gives no usable accuracy, which fails the signal gate. */
  accuracyDeg: number | null
}

export interface PointModeSensors {
  status: PointModeStatus
  stream: MediaStream | null
  position: PointModePosition | null
  heading: PointModeHeading | null
  /** Call from the user's tap: iOS asks for motion access only inside a gesture. */
  start: () => void
  stop: () => void
}

type MotionPermission = 'granted' | 'denied'

interface IOSOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

/** iOS needs an explicit motion grant, asked in the tap. Elsewhere it is implied. */
function requestMotionPermission(): Promise<MotionPermission> {
  const ctor = (globalThis as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
    .DeviceOrientationEvent
  if (typeof ctor?.requestPermission !== 'function') return Promise.resolve('granted')
  return ctor.requestPermission().then(
    (r) => (r === 'granted' ? 'granted' : 'denied'),
    () => 'denied',
  )
}

/**
 * Camera, position and compass for Point_Mode (R8.7, R8.8). Nothing here is
 * sent or stored: frames go straight to a `<video>`, and position and heading
 * live in component state for placement only. Every track, watch and listener
 * stops on `stop`, on unmount and when the tab is hidden.
 */
export function usePointModeSensors(): PointModeSensors {
  const [status, setStatus] = useState<PointModeStatus>('idle')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [position, setPosition] = useState<PointModePosition | null>(null)
  const [heading, setHeading] = useState<PointModeHeading | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const detachOrientationRef = useRef<(() => void) | null>(null)
  const frameRef = useRef<number | null>(null)
  const samplesRef = useRef<HeadingSample[]>([])
  const accuracyRef = useRef<number | null>(null)
  // Bumped on every release, so a start that resolves after a close stands down.
  const runRef = useRef(0)

  const release = useCallback(() => {
    runRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current)
    watchIdRef.current = null
    detachOrientationRef.current?.()
    detachOrientationRef.current = null
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    samplesRef.current = []
    setStream(null)
    setPosition(null)
    setHeading(null)
  }, [])

  const listenToOrientation = useCallback(() => {
    const record = (deg: number, accuracy: number | null) => {
      samplesRef.current = pushHeadingSample(samplesRef.current, { deg, at: performance.now() })
      accuracyRef.current = accuracy
    }
    const onIOS = (e: Event) => {
      const ev = e as IOSOrientationEvent
      if (typeof ev.webkitCompassHeading !== 'number') return
      const acc = ev.webkitCompassAccuracy
      record(ev.webkitCompassHeading, typeof acc === 'number' && acc >= 0 ? acc : null)
    }
    const onAbsolute = (e: Event) => {
      const ev = e as DeviceOrientationEvent
      if (ev.alpha === null || ev.beta === null || ev.gamma === null) return
      const deg = compassHeadingFromEuler(ev.alpha, ev.beta, ev.gamma)
      record(deg, ev.absolute ? ANDROID_ABSOLUTE_HEADING_ACCURACY_DEG : null)
    }
    window.addEventListener('deviceorientation', onIOS)
    window.addEventListener('deviceorientationabsolute', onAbsolute)
    detachOrientationRef.current = () => {
      window.removeEventListener('deviceorientation', onIOS)
      window.removeEventListener('deviceorientationabsolute', onAbsolute)
    }

    // One state update per frame, not per sensor event.
    const tick = () => {
      const deg = circularMean(samplesRef.current.map((s) => s.deg))
      if (deg !== null) setHeading({ deg, accuracyDeg: accuracyRef.current })
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(() => {
    // Asked first and synchronously, while the tap still counts as a gesture.
    const motion = requestMotionPermission()
    release()
    const run = runRef.current
    setStatus('starting')
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !navigator.geolocation) {
        setStatus('unsupported')
        return
      }
      let media: MediaStream
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      } catch {
        if (run !== runRef.current) return
        release()
        setStatus('camera-denied')
        return
      }
      if (run !== runRef.current) {
        media.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = media
      setStream(media)
      const motionGrant = await motion
      if (run !== runRef.current) return
      if (motionGrant === 'denied') {
        release()
        setStatus('motion-denied')
        return
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) =>
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyMetres: pos.coords.accuracy }),
        (err) => {
          if (err.code !== err.PERMISSION_DENIED) return
          release()
          setStatus('location-denied')
        },
        { enableHighAccuracy: true, maximumAge: 2000 },
      )
      listenToOrientation()
      setStatus('live')
    })()
  }, [release, listenToOrientation])

  const stop = useCallback(() => {
    release()
    setStatus('idle')
  }, [release])

  // A hidden tab keeps no camera open. Coming back needs a tap (iOS motion).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden' || !streamRef.current) return
      release()
      setStatus('paused')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [release])

  useEffect(() => release, [release])

  return { status, stream, position, heading, start, stop }
}
