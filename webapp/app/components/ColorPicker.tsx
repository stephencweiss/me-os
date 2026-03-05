"use client";

import { useState, useRef, useEffect } from "react";

interface ColorOption {
  id: string;
  name: string;
  meaning: string;
  hex: string;
}

const COLOR_OPTIONS: ColorOption[] = [
  { id: "1", name: "Lavender", meaning: "1:1s / People", hex: "#7986cb" },
  { id: "2", name: "Sage", meaning: "Studying / Learning", hex: "#33b679" },
  { id: "3", name: "Grape", meaning: "Project Work", hex: "#8e24aa" },
  { id: "4", name: "Flamingo", meaning: "Meetings", hex: "#e67c73" },
  { id: "5", name: "Banana", meaning: "Household / Pets", hex: "#f6bf26" },
  { id: "6", name: "Tangerine", meaning: "Family Time", hex: "#f4511e" },
  { id: "7", name: "Peacock", meaning: "Personal Projects", hex: "#039be5" },
  { id: "8", name: "Graphite", meaning: "Routines / Logistics", hex: "#616161" },
  { id: "9", name: "Blueberry", meaning: "Fitness", hex: "#3f51b5" },
  { id: "10", name: "Basil", meaning: "Social", hex: "#0b8043" },
  { id: "11", name: "Tomato", meaning: "Urgent / Blocked", hex: "#d50000" },
];

interface ColorPickerProps {
  currentColorId: string;
  onSelect: (colorId: string) => void;
}

export default function ColorPicker({ currentColorId, onSelect }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentColor = COLOR_OPTIONS.find((c) => c.id === currentColorId) || COLOR_OPTIONS[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(COLOR_OPTIONS.findIndex((c) => c.id === currentColorId));
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % COLOR_OPTIONS.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + COLOR_OPTIONS.length) % COLOR_OPTIONS.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) {
          onSelect(COLOR_OPTIONS[focusedIndex].id);
          setIsOpen(false);
          buttonRef.current?.focus();
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
    }
  };

  const handleSelect = (colorId: string) => {
    onSelect(colorId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button - color indicator */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="w-4 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-gray-300 dark:hover:ring-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        style={{ backgroundColor: currentColor.hex }}
        aria-label={`Change color (currently ${currentColor.meaning})`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      />

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
          role="listbox"
          aria-label="Select a color"
        >
          {COLOR_OPTIONS.map((color, index) => (
            <button
              key={color.id}
              onClick={() => handleSelect(color.id)}
              onMouseEnter={() => setFocusedIndex(index)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                focusedIndex === index
                  ? "bg-gray-100 dark:bg-gray-700"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              } ${color.id === currentColorId ? "font-medium" : ""}`}
              role="option"
              aria-selected={color.id === currentColorId}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 dark:text-white truncate">
                  {color.meaning}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {color.name}
                </div>
              </div>
              {color.id === currentColorId && (
                <span className="text-blue-600 dark:text-blue-400 text-sm">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { COLOR_OPTIONS };
