import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogContent = ({ children, className = "", ...props }) => (
    <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30" />
        <DialogPrimitive.Content
            className={`fixed top-[50%] left-[50%] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl ${className}`}
            {...props}
        >
            {children}
        </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
);

export const DialogHeader = ({ children, className = "" }) => (
    <div className={`mb-2 ${className}`}>{children}</div>
);

export const DialogTitle = ({ children, className = "" }) => (
    <h2 className={`text-lg font-bold ${className}`}>{children}</h2>
);

export const DialogFooter = ({ children, className = "" }) => (
    <div className={`mt-4 flex justify-end gap-2 ${className}`}>{children}</div>
);


