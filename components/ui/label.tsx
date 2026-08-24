"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

<<<<<<< HEAD
function Label({ className, ...props }: React.ComponentProps<"label">) {
=======
function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
<<<<<<< HEAD
    />
=======
    >
      {children}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  )
}

export { Label }
