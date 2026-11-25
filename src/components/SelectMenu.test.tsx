import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { escapeLayerCount } from '../lib/escapeStack'
import { SelectMenu } from './SelectMenu'

afterEach(cleanup)

const OPTIONS = [
  { value: null, label: 'All Games', rule: true },
  { value: 1, label: 'MIA @ PHI', meta: 'Final' },
  { value: 2, label: 'CHI @ CHA' },
  { value: 3, label: 'CLE @ NY' },
]

function Harness({ onChange = () => {} }: { onChange?: (v: number | null) => void }) {
  const [v, setV] = useState<number | null>(null)
  return (
    <>
      <SelectMenu<number | null>
        label="Game"
        value={v}
        options={OPTIONS}
        onChange={(n) => {
          setV(n)
          onChange(n)
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  )
}

const box = () => screen.getByRole('combobox', { name: 'Game' })
const active = () => {
  const id = box().getAttribute('aria-activedescendant')
  return id ? document.getElementById(id)?.querySelector('.selm-row')?.textContent : null
}

describe('SelectMenu', () => {
  it('shows the chosen label on a button and opens a listbox on click', () => {
    render(<Harness />)
    expect(box().textContent).toBe('All Games')
    expect(box().getAttribute('aria-haspopup')).toBe('listbox')
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(box())
    expect(box().getAttribute('aria-expanded')).toBe('true')
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false'])
    expect(options[1].textContent).toBe('MIA @ PHI Final')
  })

  it('picks with a click, closes, and hands focus back to the button', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(box())
    fireEvent.click(screen.getByRole('option', { name: /^CHI @ CHA/ }))
    expect(onChange).toHaveBeenCalledWith(2)
    expect(box().textContent).toBe('CHI @ CHA')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(box())
  })

  it('walks with the arrows, Home and End, and picks with Enter', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    box().focus()
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(active()).toBe('All Games')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(active()).toBe('CHI @ CHA')
    fireEvent.keyDown(box(), { key: 'End' })
    expect(active()).toBe('CLE @ NY')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(active()).toBe('CLE @ NY')
    fireEvent.keyDown(box(), { key: 'Home' })
    fireEvent.keyDown(box(), { key: 'ArrowUp' })
    expect(active()).toBe('All Games')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(1)
    expect(box().getAttribute('aria-expanded')).toBe('false')
    // opening again starts on the chosen row
    fireEvent.keyDown(box(), { key: ' ' })
    expect(active()).toBe('MIA @ PHI')
  })

  it('jumps to a row by its first letters', () => {
    render(<Harness />)
    fireEvent.keyDown(box(), { key: 'c' })
    expect(active()).toBe('CHI @ CHA')
    fireEvent.keyDown(box(), { key: 'l' })
    expect(active()).toBe('CLE @ NY')
  })

  it('closes on Esc through the shared Esc stack without picking', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(box())
    expect(escapeLayerCount()).toBe(1)
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(box().getAttribute('aria-expanded')).toBe('false')
    expect(escapeLayerCount()).toBe(0)
    expect(onChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(box())
  })

  it('closes on a tap outside and on Tab', () => {
    render(<Harness />)
    fireEvent.click(box())
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(box().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(box())
    fireEvent.keyDown(box(), { key: 'Tab' })
    expect(box().getAttribute('aria-expanded')).toBe('false')
  })
})
