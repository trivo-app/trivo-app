import { Input } from "@trivo/ui/input";
import { Label } from "@trivo/ui/label";
import { Slider } from "@trivo/ui/slider";
import { Switch } from "@trivo/ui/switch";
import { useUser } from "@/stores/use-user";
import FileUpload from "../file-upload";
import { Block, ImageBlockData } from "@/types/blocks";
import { useCallback, useState, useRef, useEffect } from "react";
import debounce from "lodash/debounce";
import { z } from "zod";

interface ImageFormProps {
  block: Block & { data?: ImageBlockData };
  onUpdate: (block: Block) => void;
}

export default function ImageForm({ block, onUpdate }: ImageFormProps) {
  const { organizationId } = useUser();

  const [localState, setLocalState] = useState<ImageBlockData>({
    image: block.data?.image || "",
    size: block.data?.size || 33,
    link: block.data?.link || "",
    centered: block.data?.centered || false,
  });
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedUpdate = useCallback(
    debounce((newState: ImageBlockData) => {
      onUpdate({
        ...block,
        data: newState,
      });
    }, 200),
    [block, onUpdate]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // URL validation schema using Zod
  const urlSchema = z.string().superRefine((url, ctx) => {
    // Empty string is valid
    if (url === "") return;

    // Check for spaces
    if (url.trim() !== url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL cannot contain spaces",
      });
      return;
    }

    // Domain and TLD pattern without requiring https://
    const urlPattern =
      /^(https?:\/\/)?[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}(\/.*)?$/;
    if (!urlPattern.test(url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Please enter a valid URL with a domain and top-level domain (e.g., example.com)",
      });
      return;
    }
  });

  const validateUrl = (url: string) => {
    try {
      urlSchema.parse(url);
      setLinkError(null);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setLinkError(error.errors[0].message);
        return false;
      }
      return true;
    }
  };

  const handleChange = (
    field: keyof ImageBlockData,
    value: string | number | boolean
  ) => {
    const newState = { ...localState, [field]: value };
    setLocalState(newState);

    // Handle link field with validation
    if (field === "link") {
      setIsTyping(true);

      // Clear any existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set a new timer to validate after typing stops
      debounceTimerRef.current = setTimeout(() => {
        setIsTyping(false);
        const isValid = validateUrl(value as string);

        // Only update parent if valid
        if (isValid) {
          onUpdate({
            ...block,
            data: newState,
          });
        }
      }, 800); // 800ms debounce
    }
    // Immediately update for centering
    else if (field === "centered") {
      onUpdate({
        ...block,
        data: newState,
      });
    }
    // Debounce for other changes
    else {
      debouncedUpdate(newState);
    }
  };

  const handleBlur = () => {
    // When input loses focus, clear typing state and validate
    if (isTyping) {
      setIsTyping(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const isValid = validateUrl(localState.link);
      if (isValid) {
        onUpdate({
          ...block,
          data: localState,
        });
      }
    }
  };

  const onImageRemove = () => {
    console.log("Removing image");
    // Update the image with an empty string
    handleChange("image", "");
  };

  if (!organizationId) return null;

  return (
    <div className="flex flex-col gap-10 px-2">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-y-4 gap-x-2 items-center">
          <Label>Image</Label>
          <FileUpload
            organizationId={organizationId}
            onUploadComplete={(path) => handleChange("image", path)}
            type="image"
            initialFilePath={localState.image}
            onRemove={onImageRemove}
          />
          <Label>Size</Label>
          <Slider
            value={[localState.size]}
            max={100}
            min={40}
            step={1}
            className="col-span-2"
            onValueChange={(value) => handleChange("size", value[0])}
          />
          <Label>Link</Label>
          <div className="col-span-2 flex flex-col gap-1">
            <Input
              className={linkError && !isTyping ? "border-red-500" : ""}
              placeholder="https://..."
              value={localState.link}
              onChange={(e) => handleChange("link", e.target.value)}
              onBlur={handleBlur}
            />
            {linkError && !isTyping && (
              <p className="text-xs text-red-500">{linkError}</p>
            )}
          </div>
          <Label>Center Image</Label>
          <div className="col-span-2">
            <Switch
              checked={localState.centered}
              onCheckedChange={(checked) => handleChange("centered", checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
