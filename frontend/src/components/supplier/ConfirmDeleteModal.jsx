import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/Dialog";
import Button from "../Button";

export default function ConfirmDeleteModal({ open, onOpenChange, itemName, onConfirm, loading }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-red-600">Xác nhận xóa</DialogTitle>
                </DialogHeader>
                <p className="mt-2 text-gray-700">
                    Bạn có chắc muốn xóa <b>{itemName}</b>? Hành động này không thể hoàn tác.
                </p>
                <DialogFooter className="mt-4 flex justify-end gap-3">
                    <Button type="button" className="bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => onOpenChange(false)}>
                        Hủy
                    </Button>
                    <Button type="button" className="bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm} disabled={loading}>
                        {loading ? "Đang xóa..." : "Xóa ngay"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
