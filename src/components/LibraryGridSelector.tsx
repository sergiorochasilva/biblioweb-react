import { CheckCircleOutlined } from "@ant-design/icons";
import { Empty } from "antd";

export type LibraryGridSelectorOption = {
    value: string;
    label: string;
    description?: string;
};

export type LibraryGridSelectorProps = {
    label: string;
    helperText?: string;
    error?: string;
    value: string[];
    options: LibraryGridSelectorOption[];
    emptyDescription?: string;
    onChange: (values: string[]) => void;
};

/**
 * Alterna a presença de um valor na seleção atual.
 *
 * @param current Valores atualmente selecionados.
 * @param selected Valor clicado.
 * @returns Próxima seleção sem duplicidades.
 */
function toggleSelection(current: string[], selected: string): string[] {
    if (current.includes(selected)) {
        return current.filter((item) => item !== selected);
    }

    return Array.from(new Set([...current, selected]));
}

/**
 * Renderiza uma grade de cartões para seleção múltipla de acervos.
 *
 * @param props Propriedades do componente.
 * @returns Componente visual de grade de seleção.
 */
export default function LibraryGridSelector({
    label,
    helperText,
    error,
    value,
    options,
    emptyDescription,
    onChange,
}: LibraryGridSelectorProps) {
    const selectedCount = value.length;

    return (
        <div className="library-grid-field">
            <div className="library-grid-header">
                <label className="field-label">{label}</label>
                <span className="library-grid-count">
                    {selectedCount} {selectedCount === 1 ? "selecionado" : "selecionados"}
                </span>
            </div>

            {helperText && <p className="library-grid-hint">{helperText}</p>}

            {error && <span className="form-field-error">{error}</span>}

            {options.length <= 0 ? (
                <Empty
                    className="library-grid-empty"
                    description={emptyDescription || "Nenhum acervo disponível."}
                />
            ) : (
                <div className="library-grid">
                    {options.map((option) => {
                        const checked = value.includes(option.value);

                        return (
                            <button
                                key={option.value}
                                type="button"
                                className={`library-grid-card${checked ? " is-selected" : ""}`}
                                onClick={() => {
                                    onChange(toggleSelection(value, option.value));
                                }}
                                aria-pressed={checked}
                            >
                                <span className="library-grid-card-icon" aria-hidden="true">
                                    <CheckCircleOutlined />
                                </span>
                                <span className="library-grid-card-body">
                                    <span className="library-grid-card-title">{option.label}</span>
                                    <span className="library-grid-card-status">
                                        {checked ? "Selecionado" : "Toque para selecionar"}
                                    </span>
                                    {option.description && (
                                        <span className="library-grid-card-subtitle">
                                            {option.description}
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
