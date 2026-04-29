import { Tag } from "antd";

type BookTypeTagProps = {
    type?: string;
    className?: string;
};

type BookTypePresentation = {
    label: string;
    color: string;
};

const BOOK_TYPE_PRESENTATION: Record<string, BookTypePresentation> = {
    external: {
        label: "Externo",
        color: "green",
    },
    free: {
        label: "Livre",
        color: "blue",
    },
    protected: {
        label: "Protegido",
        color: "gold",
    },
};

/**
 * Resolve a apresentação visual de um tipo de livro.
 *
 * @param type Tipo bruto retornado pela API.
 * @returns Texto e cor usados no badge.
 */
function getBookTypePresentation(type?: string): BookTypePresentation {
    const normalizedType = (type || "").trim().toLowerCase();
    return (
        BOOK_TYPE_PRESENTATION[normalizedType] || {
            label: normalizedType ? "Tipo não informado" : "Tipo não informado",
            color: "default",
        }
    );
}

/**
 * Exibe o tipo de livro com uma tag colorida e compacta.
 *
 * @param type Tipo bruto do livro.
 * @param className Classes extras para posicionamento.
 * @returns Tag visual do tipo do livro.
 */
export default function BookTypeTag({ type, className = "" }: BookTypeTagProps) {
    const presentation = getBookTypePresentation(type);

    return (
        <Tag className={`book-type-tag ${className}`.trim()} color={presentation.color}>
            {presentation.label}
        </Tag>
    );
}
