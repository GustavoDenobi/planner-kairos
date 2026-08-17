import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { IconGripVertical } from '@/ui/components/icons';

export type SortableDragHandleProps = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  isDragging: boolean;
};

type SortableListProps<T extends { id: string }> = {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, handle: SortableDragHandleProps) => ReactNode;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

function SortableRow<T extends { id: string }>({
  item,
  disabled,
  renderItem,
}: {
  item: T;
  disabled: boolean;
  renderItem: SortableListProps<T>['renderItem'];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-70' : undefined}
    >
      {renderItem(item, {
        attributes,
        listeners,
        setActivatorNodeRef,
        isDragging,
      })}
    </li>
  );
}

export function SortableDragHandle({
  attributes,
  listeners,
  setActivatorNodeRef,
  label,
}: SortableDragHandleProps & { label: string }) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="flex h-8 w-6 shrink-0 touch-none items-center justify-center self-start rounded text-muted transition-colors hover:bg-bg hover:text-text"
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <IconGripVertical className="h-4 w-4" />
    </button>
  );
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  disabled = false,
  ariaLabel,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className={className} aria-label={ariaLabel}>
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              disabled={disabled}
              renderItem={renderItem}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
