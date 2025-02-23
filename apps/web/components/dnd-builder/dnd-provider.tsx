"use client";

import type { Block as BlockType } from "@/types/blocks";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { useState, useEffect } from "react";
import DndBuilderCanvas from "./canvas";
import DndBuilderSidebar from "./sidebar";
import { motion, AnimatePresence } from "framer-motion";
import Toolbar from "./rich-text-editor/rich-text-format-bar";
import { createEditor } from "./rich-text-editor/editor";
import { Editor } from "@tiptap/react";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { allBlockTypes } from "./sidebar"; // We'll need to export this from sidebar
import Block from "./block";

export default function DndProvider() {
  const [blocks, setBlocks] = useState<BlockType[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState("#f4f4f5");
  const [editors, setEditors] = useState<Record<string, Editor | null>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Handle reordering of existing blocks
    if (!active.data.current?.fromSidebar) {
      const oldIndex = blocks.findIndex((block) => block.id === active.id);
      const newIndex = blocks.findIndex((block) => block.id === over.id);

      if (oldIndex !== newIndex) {
        // Use arrayMove but keep editor references intact
        const newBlocks = arrayMove(blocks, oldIndex, newIndex);
        setBlocks(newBlocks);
        // The editors object doesn't need to change since it's keyed by ID
      }
    } else {
      // Handle new blocks from sidebar
      const newBlockId = crypto.randomUUID();
      const blockType = active.data.current.type;

      const newBlock: BlockType = {
        id: newBlockId,
        type: blockType,
      };

      if (blockType === "text") {
        const newEditor = createEditor();
        setEditors((prev) => ({
          ...prev,
          [newBlockId]: newEditor,
        }));
      }

      // Insert the new block based on the block we're hovering over
      setBlocks((prevBlocks) => {
        const newBlocks = [...prevBlocks];

        // If dropping on the canvas directly, append to the end
        if (over.id === "canvas") {
          return [...newBlocks, newBlock];
        }

        // If hovering over a block, insert based on position
        const overIndex = prevBlocks.findIndex((block) => block.id === over.id);
        if (overIndex !== -1) {
          const rect = over.rect as DOMRect;
          const mouseY = active.rect.current.translated.top;
          const threshold = rect.top + rect.height / 2;

          const insertIndex = mouseY < threshold ? overIndex : overIndex + 1;
          newBlocks.splice(insertIndex, 0, newBlock);
        }

        return newBlocks;
      });
    }
  };

  const handleDeleteBlock = (id: string) => {
    if (editors[id]) {
      editors[id]?.destroy();
      setEditors((prev) => {
        const newEditors = { ...prev };
        delete newEditors[id];
        return newEditors;
      });
    }
    setBlocks(blocks.filter((block) => block.id !== id));
    if (id === selectedBlockId) {
      setSelectedBlockId(null);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup all editors on unmount
      Object.values(editors).forEach((editor) => editor?.destroy());
    };
  }, []);

  const renderDragOverlay = () => {
    if (!activeId) return null;

    // If it's from sidebar (new block)
    if (activeId.toString().startsWith("sidebar-")) {
      const blockType = activeId.replace("sidebar-", "");
      const blockData = allBlockTypes.find((b) => b.type === blockType);

      if (blockData) {
        return (
          <div className="flex flex-col items-center gap-1 bg-accent p-3 rounded-md cursor-grab border shadow-sm opacity-80">
            <blockData.icon />
            <span>{blockData.label}</span>
          </div>
        );
      }
    }

    // If it's an existing block
    const draggedBlock = blocks.find((block) => block.id === activeId);
    if (draggedBlock) {
      return (
        <Block
          id={draggedBlock.id}
          type={draggedBlock.type}
          isDragging={true}
          editor={editors[draggedBlock.id]}
          isOverlay
        />
      );
    }

    return null;
  };

  return (
    <DndContext
      id="dnd-builder"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 relative">
        <DndBuilderSidebar
          type="email"
          onBgColorChange={setBgColor}
          bgColor={bgColor}
          selectedBlock={
            selectedBlockId &&
            blocks.find((block) => block.id === selectedBlockId)
              ? {
                  id: selectedBlockId,
                  type: blocks.find((block) => block.id === selectedBlockId)!
                    .type,
                }
              : null
          }
          setSelectedBlockId={setSelectedBlockId}
          onDeleteBlock={handleDeleteBlock}
        />
        <div className="flex-1 relative">
          <AnimatePresence>
            {selectedBlockId &&
              blocks.find((block) => block.id === selectedBlockId)?.type ===
                "text" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 40 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, damping: 20 }}
                  className="sticky top-12 bg-background z-50 overflow-hidden"
                >
                  <Toolbar editor={editors[selectedBlockId]} />
                </motion.div>
              )}
          </AnimatePresence>
          <SortableContext
            items={blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            <DndBuilderCanvas
              blocks={blocks}
              bgColor={bgColor}
              onBlockSelect={setSelectedBlockId}
              selectedBlockId={selectedBlockId}
              editors={editors}
            />
          </SortableContext>
        </div>
      </div>
      <DragOverlay>{renderDragOverlay()}</DragOverlay>
    </DndContext>
  );
}
