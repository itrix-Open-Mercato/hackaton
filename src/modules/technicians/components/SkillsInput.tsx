"use client"

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { X, Plus } from 'lucide-react'

type SkillsInputProps = {
  value: string[]
  label: string
  placeholder: string
  onChange: (value: string[]) => void
}

export default function SkillsInput({ value, label, placeholder, onChange }: SkillsInputProps) {
  const [newSkill, setNewSkill] = React.useState('')

  const addSkill = () => {
    const trimmed = newSkill.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setNewSkill('')
    }
  }

  const removeSkill = (skill: string) => {
    onChange(value.filter((s) => s !== skill))
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
            {s}
            <button type="button" className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => removeSkill(s)}>
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 rounded-md border px-3 py-1.5 text-sm"
          placeholder={placeholder}
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addSkill()
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={addSkill} disabled={!newSkill.trim()}>
          <Plus size={14} className="mr-1" />
          Dodaj
        </Button>
      </div>
    </div>
  )
}
