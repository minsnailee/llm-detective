import type { ChangeEvent } from "react";

export function SummaryModal({
    open,
    summary,
    onClose,
}: {
    open: boolean;
    summary?: string;
    onClose: () => void;
}) {
    if (!open) return null;
    return (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
            <div className="bg-white p-6 rounded-lg max-w-lg shadow border">
                <h3 className="font-bold mb-2">사건 개요</h3>
                <p className="whitespace-pre-line">{summary}</p>
                <button
                    onClick={onClose}
                    className="mt-4 px-3 py-1 bg-black text-white rounded"
                >
                    닫기
                </button>
            </div>
        </div>
    );
}

export function FloorplanModal({
    open,
    imageUrl,
    onClose,
}: {
    open: boolean;
    imageUrl?: string;
    onClose: () => void;
}) {
    if (!open || !imageUrl) return null;
    return (
        <div
            role="dialog"
            aria-modal
            className="absolute inset-0 bg-black/50 grid place-items-center z-30"
            onClick={onClose}
        >
            <div
                className="max-w-[90vw] max-h-[90vh] bg-white rounded-xl border overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center px-3 h-10 border-b bg-gray-50">
                    <strong>도면/지도</strong>
                    <button className="ml-auto text-sm" onClick={onClose}>
                        닫기
                    </button>
                </div>
                <div className="p-2 bg-black grid place-items-center max-h-[85vh] overflow-auto">
                    <img
                        src={imageUrl}
                        alt="floorplan"
                        className="max-w-full max-h-[82vh]"
                    />
                </div>
            </div>
        </div>
    );
}

export function NotesModal({
    open,
    notes,
    onChange,
    onClose,
    onReset,
}: {
    open: boolean;
    notes: string;
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    onClose: () => void;
    onReset: () => void;
}) {
    if (!open) return null;
    return (
        <div
            role="dialog"
            aria-modal
            className="absolute inset-0 bg-black/45 grid place-items-center z-30"
            onClick={onClose}
        >
            <div
                className="w-[560px] max-w-[90vw] bg-white rounded-xl p-3 border"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2">
                    <h4 className="m-0 font-bold">사건수첩</h4>
                    <div className="ml-auto">
                        <button
                            onClick={onReset}
                            title="메모 내용을 전부 비웁니다."
                            className="px-2 py-1 border rounded"
                        >
                            초기화
                        </button>
                        <button
                            className="ml-2 px-2 py-1 border rounded"
                            onClick={onClose}
                        >
                            닫기
                        </button>
                    </div>
                </div>
                <textarea
                    value={notes}
                    onChange={onChange}
                    placeholder="중요한 단서/의심 포인트를 메모하세요. (자동 저장)"
                    className="mt-2 w-full min-h=[260px] rounded border p-2"
                    style={{ minHeight: 260 }}
                />
            </div>
        </div>
    );
}
