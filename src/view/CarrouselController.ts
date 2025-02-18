import { useState, RefObject } from "react";

export interface UseCarousel {
    handleScroll: (ref: RefObject<HTMLDivElement>, direction: "left" | "right", key: string) => void;
    scrollPositions: { [key: string]: number };
}

export function useCarousel() {
    const [scrollPositions, setScrollPositions] = useState<{ [key: string]: number }>({});

    const handleScroll = (
        ref: RefObject<HTMLDivElement | null>,
        direction: "left" | "right",
        key: string
    ) => {
        if (ref.current) {
            const scrollAmount = 300; // Quantidade de deslocamento por clique
            const maxScroll = ref.current.scrollWidth - ref.current.clientWidth;

            let newScrollPosition = scrollPositions[key] || 0;

            if (direction === "left") {
                newScrollPosition = Math.max(0, newScrollPosition - scrollAmount);
            } else {
                newScrollPosition = Math.min(maxScroll, newScrollPosition + scrollAmount);
            }

            setScrollPositions((prev) => ({ ...prev, [key]: newScrollPosition }));
            ref.current.style.transform = `translateX(-${newScrollPosition}px)`;
        }
    };

    return { handleScroll, scrollPositions };
};
