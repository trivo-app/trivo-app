import React, { useEffect, useState, useMemo } from "react";
import { Button } from "@church-space/ui/button";
import type { CardsBlockData } from "@/types/blocks";
import { createClient } from "@church-space/supabase/client";
import Image from "next/image";
interface CardsBlockProps {
  data?: CardsBlockData;
  defaultFont?: string;
  defaultTextColor?: string;
}

export default function CardsBlock({
  data,
  defaultFont,
  defaultTextColor,
}: CardsBlockProps) {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const title = data?.title || "Cards";
  const subtitle = data?.subtitle || "Add a card to your page";

  // Memoize the cards array to prevent it from changing on every render
  const cards = useMemo(() => data?.cards || [], [data?.cards]);

  useEffect(() => {
    const supabase = createClient();

    // Get public URLs for all card images
    cards.forEach((card) => {
      if (card.image && !imageUrls[card.image]) {
        const { data: urlData } = supabase.storage
          .from("email_assets")
          .getPublicUrl(card.image);
        setImageUrls((prev) => ({
          ...prev,
          [card.image]: urlData.publicUrl,
        }));
      }
    });
  }, [cards]);

  return (
    <div
      className="flex flex-col gap-5 py-4"
      style={{ fontFamily: defaultFont || "inherit" }}
    >
      <div className="flex flex-col">
        <span
          className="text-3xl font-bold"
          style={{ color: defaultTextColor }}
        >
          {title}
        </span>
        <span
          className=" text-muted-foreground"
          style={{ color: defaultTextColor }}
        >
          {subtitle}
        </span>
      </div>
      <div className="gap-6 grid grid-cols-1 lg:grid-cols-2 gap-y-10">
        {cards.map((card, index) => (
          <div className="w-full flex flex-col gap-2" key={index}>
            {card.image && imageUrls[card.image] && (
              <Image
                src={imageUrls[card.image]}
                alt={card.title}
                className="w-full h-48 object-cover rounded-md"
                width={1280}
                height={720}
              />
            )}
            <div className="flex flex-col px-1 gap-0.5">
              <h3
                className="text-sm font-medium"
                style={{ color: data?.labelColor }}
              >
                {card.label}
              </h3>
              <h3
                className="text-lg font-bold"
                style={{ color: defaultTextColor }}
              >
                {card.title}
              </h3>
              <p
                className="text-sm text-muted-foreground"
                style={{ color: defaultTextColor }}
              >
                {card.description}
              </p>
            </div>
            {card.buttonText && (
              <Button variant="outline">{card.buttonText}</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
