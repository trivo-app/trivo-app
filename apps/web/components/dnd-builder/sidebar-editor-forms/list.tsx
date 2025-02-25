import type { Block, ListBlockData } from "@/types/blocks";
import { Button } from "@trivo/ui/button";
import { Input } from "@trivo/ui/input";
import { Textarea } from "@trivo/ui/textarea";
import { Label } from "@trivo/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@trivo/ui/select";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState, useRef } from "react";
import ColorPicker from "../color-picker";

interface ListFormProps {
  block: Block & { data?: ListBlockData };
  onUpdate: (block: Block, addToHistory?: boolean) => void;
}

export default function ListForm({ block, onUpdate }: ListFormProps) {
  const [localState, setLocalState] = useState<ListBlockData>({
    title: block.data?.title || "List Title",
    subtitle: block.data?.subtitle || "List Subtitle",
    textColor: block.data?.textColor || "#000000",
    bulletColor: block.data?.bulletColor || "#000000",
    bulletType: block.data?.bulletType || "number",
    items: block.data?.items || [],
  });

  // Create a ref to store the latest state for the debounced function
  const stateRef = useRef(localState);

  // Update the ref whenever localState changes
  useEffect(() => {
    stateRef.current = localState;
  }, [localState]);

  // Create a debounced function that only updates the history
  const debouncedHistoryUpdate = useCallback(
    debounce(() => {
      console.log("List form updating block in history:", {
        blockId: block.id,
        blockType: block.type,
        newState: stateRef.current,
      });
      // Add to history
      onUpdate(
        {
          ...block,
          data: stateRef.current,
        },
        true
      );
    }, 500),
    [block, onUpdate]
  );

  const handleChange = (field: string, value: any) => {
    // Immediately update the local state for responsive UI
    const newState = {
      ...localState,
      [field]: value,
    };
    setLocalState(newState);

    // Update the UI immediately without adding to history
    onUpdate(
      {
        ...block,
        data: newState,
      },
      false
    );

    // Debounce the history update
    debouncedHistoryUpdate();
  };

  useEffect(() => {
    setLocalState({
      title: block.data?.title || "List Title",
      subtitle: block.data?.subtitle || "List Subtitle",
      textColor: block.data?.textColor || "#000000",
      bulletColor: block.data?.bulletColor || "#000000",
      bulletType: block.data?.bulletType || "number",
      items: block.data?.items || [],
    });
  }, [block.data]);

  const addItem = () => {
    const newItems = [
      ...localState.items,
      { title: "New Item", description: "Description" },
    ];
    handleChange("items", newItems);
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...localState.items];
    newItems[index] = { ...newItems[index], [field]: value };
    handleChange("items", newItems);
  };

  const removeItem = (index: number) => {
    const newItems = localState.items.filter((_, i) => i !== index);
    handleChange("items", newItems);
  };

  return (
    <div className="flex flex-col gap-10 px-2">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <Label className="font-bold text-md">Details</Label>
        </div>
        <div className="grid grid-cols-3 gap-y-4 gap-x-2 items-center">
          <Label>Title</Label>
          <Input
            className="col-span-2"
            value={localState.title}
            onChange={(e) => handleChange("title", e.target.value)}
          />
          <Label>Subtitle</Label>
          <Input
            className="col-span-2"
            value={localState.subtitle}
            onChange={(e) => handleChange("subtitle", e.target.value)}
          />
          <Label>Text Color</Label>
          <ColorPicker
            value={localState.textColor}
            onChange={(color) => handleChange("textColor", color)}
          />
          <Label>Bullet Color</Label>
          <ColorPicker
            value={localState.textColor}
            onChange={(color) => handleChange("bulletColor", color)}
          />
          <Label>Bullet Type</Label>
          <Select
            value={localState.bulletType}
            onValueChange={(value) => handleChange("bulletType", value)}
          >
            <SelectTrigger className="col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="bullet">Bullet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <Label className="font-bold text-md">Items</Label>
          <Button variant="outline" onClick={addItem}>
            Add Item
          </Button>
        </div>
        {localState.items.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-3 gap-y-2 gap-x-2 items-center border rounded-md p-4"
          >
            <Label>Title</Label>
            <Input
              className="col-span-2"
              value={item.title}
              onChange={(e) => updateItem(index, "title", e.target.value)}
            />
            <Label>Description</Label>
            <Textarea
              className="col-span-2"
              value={item.description}
              onChange={(e) => updateItem(index, "description", e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => removeItem(index)}
              className="col-span-3 mt-2"
            >
              Remove Item
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
