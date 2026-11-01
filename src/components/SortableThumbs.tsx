import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, RotateCw, FileText } from 'lucide-react';

export type ThumbItem = { id: string; name: string; thumb?: string; rotation?: number };

function Thumb({ item, index, onRemove, onRotate }: { item: ThumbItem; index: number; onRemove: () => void; onRotate?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative cursor-grab touch-none select-none rounded-lg border bg-card p-2 shadow-sm active:cursor-grabbing ${isDragging ? 'z-10 opacity-80 ring-2 ring-primary' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-muted">
        {item.thumb ? (
          <img src={item.thumb} alt="" className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `rotate(${item.rotation ?? 0}deg)` }} draggable={false} />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-xs">
        <span className="rounded bg-muted px-1.5 font-mono">{index + 1}</span>
        <span className="truncate">{item.name}</span>
      </div>
      <div className="absolute right-1 top-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        {onRotate && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onRotate} className="rounded-full bg-background p-1 shadow" aria-label="Rotate">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        )}
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} className="rounded-full bg-background p-1 shadow" aria-label="Remove">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function SortableThumbs<T extends ThumbItem>({
  items, onChange, onRotate,
}: { items: T[]; onChange: (items: T[]) => void; onRotate?: (id: string) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    onChange(arrayMove(items, from, to));
  };
  if (!items.length) return null;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((it, i) => (
            <Thumb
              key={it.id}
              item={it}
              index={i}
              onRemove={() => onChange(items.filter((x) => x.id !== it.id))}
              onRotate={onRotate ? () => onRotate(it.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
