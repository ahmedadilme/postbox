"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createLabel } from "@/app/actions/labels"
import { toast } from "sonner"

const LABEL_COLORS = ["#6366f1", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#ec4899"]

export function CreateLabelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(LABEL_COLORS[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await createLabel(name.trim(), color)
      setName("")
      onOpenChange(false)
      onCreated()
      toast.success("Label created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create label")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New label</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="labelName">Name</Label>
              <Input id="labelName" value={name} onChange={(event) => setName(event.target.value)} maxLength={64} required autoFocus />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Color</legend>
              <div className="flex flex-wrap gap-2">
                {LABEL_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={`Choose ${option} label color`}
                    aria-pressed={color === option}
                    onClick={() => setColor(option)}
                    className={`h-7 w-7 rounded-full ring-offset-background ${color === option ? "ring-2 ring-ring ring-offset-2" : ""}`}
                    style={{ backgroundColor: option }}
                  />
                ))}
              </div>
            </fieldset>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create label"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
