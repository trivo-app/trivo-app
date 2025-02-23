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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@trivo/ui/breadcrumb";
import { Button } from "@trivo/ui/button";
import { Undo, Redo } from "@trivo/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@trivo/ui/tooltip";

export default function DndProvider() {
  const [blocks, setBlocks] = useState<BlockType[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState("#f4f4f5");
  const [editors, setEditors] = useState<Record<string, Editor>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  // Initialize editors for text blocks
  useEffect(() => {
    const missingEditors = blocks.filter(
      (block) => block.type === "text" && !editors[block.id]
    );

    if (missingEditors.length > 0) {
      const newEditors = { ...editors };
      missingEditors.forEach((block) => {
        newEditors[block.id] = createEditor();
      });

      setEditors(newEditors);
    }
  }, [blocks]);

  // Handle drag end and block creation
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    if (!active.data.current?.fromSidebar) {
      // Handle reordering of existing blocks
      const oldIndex = blocks.findIndex((block) => block.id === active.id);
      const newIndex = blocks.findIndex((block) => block.id === over.id);

      if (oldIndex !== newIndex) {
        // Store current editors state and their content
        const currentEditors = { ...editors };
        const editorContents: Record<string, string> = {};

        // Save all editor contents before destroying
        Object.entries(currentEditors).forEach(([id, editor]) => {
          if (editor && !editor.isDestroyed) {
            editorContents[id] = editor.getHTML();
          }
        });

        setBlocks((prevBlocks) => {
          const newBlocks = arrayMove(prevBlocks, oldIndex, newIndex);

          // Use RAF to ensure DOM is ready before editor updates
          requestAnimationFrame(() => {
            const updatedEditors: Record<string, Editor> = {};

            // First destroy any editors that need to be recreated
            newBlocks.forEach((block) => {
              if (block.type === "text") {
                const existingEditor = currentEditors[block.id];
                if (existingEditor && !existingEditor.isDestroyed) {
                  existingEditor.destroy();
                }
              }
            });

            // Then create new editors with preserved content
            newBlocks.forEach((block) => {
              if (block.type === "text") {
                const newEditor = createEditor();
                // Restore content if it exists
                if (editorContents[block.id]) {
                  newEditor.commands.setContent(editorContents[block.id]);
                }
                updatedEditors[block.id] = newEditor;
              }
            });

            setEditors(updatedEditors);
          });

          return newBlocks;
        });
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

      setBlocks((prevBlocks) => {
        if (over.id === "canvas") {
          return [...prevBlocks, newBlock];
        }

        const overIndex = prevBlocks.findIndex((block) => block.id === over.id);
        if (overIndex !== -1) {
          const newBlocks = [...prevBlocks];
          const rect = over.rect as DOMRect;
          const mouseY = active.rect.current.translated.top;
          const threshold = rect.top + rect.height / 2;
          const insertIndex = mouseY < threshold ? overIndex : overIndex + 1;
          newBlocks.splice(insertIndex, 0, newBlock);
          return newBlocks;
        }

        return prevBlocks;
      });
    }
  };

  // Cleanup editors when blocks are removed
  const handleDeleteBlock = (id: string) => {
    if (editors[id]) {
      editors[id].destroy();
      setEditors((prev) => {
        const newEditors = { ...prev };
        delete newEditors[id];
        return newEditors;
      });
    }
    setBlocks((prev) => prev.filter((block) => block.id !== id));
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(editors).forEach((editor) => {
        if (editor && !editor.isDestroyed) {
          editor.destroy();
        }
      });
    };
  }, []);

  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id);
  };

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
    <div className="flex flex-col h-full relative">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b sticky top-0 left-0 right-0 bg-background z-10">
        <div className="flex items-center gap-2 px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Emails</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Email Subject</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center gap-2 px-4">
          <div className="flex gap-1 mr-2 items-center">
            <p className="text-sm text-muted-foreground">Saved 12 hours ago</p>
          </div>
          <div className="flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Undo />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Redo />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>
          </div>
          <Button variant="outline">Preview</Button>
          <Button variant="outline">Send Test</Button>
          <Button variant="default">Save</Button>
        </div>
      </header>
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
    </div>
  );
}
