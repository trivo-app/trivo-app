import { useState, useCallback, useEffect } from "react";
import { Button } from "@trivo/ui/button";
import { Input } from "@trivo/ui/input";
import { Label } from "@trivo/ui/label";
import { Textarea } from "@trivo/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@trivo/ui/accordion";
import { useUser } from "@/stores/use-user";
import FileUpload from "../file-upload";
import type { Block, CardsBlockData } from "@/types/blocks";
import debounce from "lodash/debounce";

interface CardsFormProps {
  block: Block & { data?: CardsBlockData };
  onUpdate: (block: Block) => void;
}

export default function CardsForm({ block, onUpdate }: CardsFormProps) {
  const { organizationId } = useUser();
  const [openCard, setOpenCard] = useState<string | undefined>(undefined);

  const [localState, setLocalState] = useState<CardsBlockData>({
    title: block.data?.title || "Cards",
    subtitle: block.data?.subtitle || "Add a card to your page",
    cards: block.data?.cards || [],
  });

  // Create a memoized callback for updating the block
  const updateBlock = useCallback(
    (newState: CardsBlockData) => {
      onUpdate({
        ...block,
        data: newState,
      });
    },
    [block, onUpdate]
  );

  // Create a debounced version of the update function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdate = useCallback(
    debounce((newState: CardsBlockData) => {
      updateBlock(newState);
    }, 500),
    [updateBlock]
  );

  // Cleanup the debounced function when component unmounts
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  const handleChange = (key: keyof CardsBlockData, value: any) => {
    const newState = { ...localState, [key]: value };
    setLocalState(newState);
    debouncedUpdate(newState);
  };

  const addCard = () => {
    const newCards = [
      ...localState.cards,
      {
        title: "",
        description: "",
        label: "",
        buttonText: "",
        buttonLink: "",
        image: "",
      },
    ];
    handleChange("cards", newCards);
  };

  const updateCard = (index: number, key: string, value: string) => {
    const newCards = [...localState.cards];
    newCards[index] = { ...newCards[index], [key]: value };
    handleChange("cards", newCards);
  };

  const removeCard = (index: number) => {
    const newCards = localState.cards.filter((_, i) => i !== index);
    handleChange("cards", newCards);
  };

  if (!organizationId) return null;

  return (
    <div className="flex flex-col gap-10 px-2">
      <div className="flex flex-col gap-4">
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
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <Label className="font-bold text-md">Cards</Label>
          <Button variant="outline" onClick={addCard}>
            Add Card
          </Button>
        </div>
        <Accordion
          type="single"
          collapsible
          value={openCard}
          onValueChange={setOpenCard}
        >
          {localState.cards.map((card, index) => (
            <AccordionItem key={index} value={index.toString()}>
              <AccordionTrigger>Card {index + 1}</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-3 gap-y-4 gap-x-2 items-center">
                  <Label>Label</Label>
                  <Input
                    className="col-span-2"
                    value={card.label}
                    onChange={(e) => updateCard(index, "label", e.target.value)}
                  />
                  <Label>Title</Label>
                  <Input
                    className="col-span-2"
                    value={card.title}
                    onChange={(e) => updateCard(index, "title", e.target.value)}
                  />
                  <Label>Description</Label>
                  <Textarea
                    className="col-span-2"
                    value={card.description}
                    onChange={(e) =>
                      updateCard(index, "description", e.target.value)
                    }
                  />
                  <Label>Image</Label>
                  <div className="col-span-2">
                    <FileUpload
                      organizationId={organizationId}
                      onUploadComplete={(path) =>
                        updateCard(index, "image", path)
                      }
                      type="image"
                    />
                  </div>
                  <Label>Button Text</Label>
                  <Input
                    className="col-span-2"
                    value={card.buttonText}
                    onChange={(e) =>
                      updateCard(index, "buttonText", e.target.value)
                    }
                  />
                  <Label>Button Link</Label>
                  <Input
                    className="col-span-2"
                    value={card.buttonLink}
                    onChange={(e) =>
                      updateCard(index, "buttonLink", e.target.value)
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() => removeCard(index)}
                    className="col-span-3 mt-2"
                  >
                    Remove Card
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
