// @vitest-environment jsdom
/**
 * First-touch Acquisition_Source on the web client (GlyphCity rebrand R10.3).
 */
import { acquisitionFromRef } from '@area-code/shared/constants/attribution'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  ACQUISITION_STORAGE_KEY,
  captureAcquisitionFromLocation,
  classifyFirstVisit,
  clearAcquisitionSource,
  readAcquisitionSource,
} from '../acquisition'

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('acquisitionFromRef', () => {
  it('reads creator links with or without a handle', () => {
    expect(acquisitionFromRef('creator')).toBe('creator')
    expect(acquisitionFromRef('creator-thandi_jhb')).toBe('creator')
    expect(acquisitionFromRef('CREATOR')).toBe('creator')
    expect(acquisitionFromRef('creatorx')).toBeNull()
    expect(acquisitionFromRef('billboard')).toBeNull()
    expect(acquisitionFromRef(null)).toBeNull()
  })
})

describe('classifyFirstVisit', () => {
  it('ranks a creator ref above every other signal', () => {
    expect(classifyFirstVisit('/node/fox-street-yard', '?ref=creator-thandi')).toBe('creator')
  })

  it('reads venue links, QR codes and plain visits', () => {
    expect(classifyFirstVisit('/node/fox-street-yard', '')).toBe('share')
    expect(classifyFirstVisit('/map', '?venue=fox-street-yard&src=share')).toBe('share')
    expect(classifyFirstVisit('/qr/node-1/AB12CD34', '')).toBe('qr')
    expect(classifyFirstVisit('/', '')).toBe('organic')
    expect(classifyFirstVisit('/map', '')).toBe('organic')
  })
})

describe('first touch wins', () => {
  it('keeps the first visit and ignores later ones', () => {
    window.history.replaceState({}, '', '/?ref=creator-thandi')
    expect(captureAcquisitionFromLocation()).toBe('creator')
    window.history.replaceState({}, '', '/node/fox-street-yard')
    expect(captureAcquisitionFromLocation()).toBe('creator')
    expect(readAcquisitionSource()).toBe('creator')
  })

  it('reads organic when nothing is stored, and clears after sign-up', () => {
    expect(readAcquisitionSource()).toBe('organic')
    localStorage.setItem(ACQUISITION_STORAGE_KEY, 'qr')
    expect(readAcquisitionSource()).toBe('qr')
    clearAcquisitionSource()
    expect(localStorage.getItem(ACQUISITION_STORAGE_KEY)).toBeNull()
  })

  it('ignores a tampered stored value', () => {
    localStorage.setItem(ACQUISITION_STORAGE_KEY, 'billboard')
    expect(readAcquisitionSource()).toBe('organic')
  })
})
