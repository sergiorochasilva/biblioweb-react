import { InputNumber, Empty, Switch } from "antd";

export type LibraryLimitGridOption = {
    value: string;
    label: string;
};

export type LibraryLimitGridValue = {
    library: string;
    max_concurrent_loans: string;
};

export type LibraryLimitGridProps = {
    label: string;
    helperText?: string;
    error?: string;
    value: LibraryLimitGridValue[];
    options: LibraryLimitGridOption[];
    defaultLimit: string;
    emptyDescription?: string;
    onChange: (values: LibraryLimitGridValue[]) => void;
};

/**
 * Alterna a presença de uma biblioteca na seleção.
 *
 * @param current Limites atualmente selecionados.
 * @param selected Biblioteca clicada.
 * @param defaultLimit Limite inicial para nova associação.
 * @returns Próxima lista sem duplicidades.
 */
function toggleSelection(
    current: LibraryLimitGridValue[],
    selected: string,
    defaultLimit: string
): LibraryLimitGridValue[] {
    const existingIndex = current.findIndex((item) => item.library === selected);
    if (existingIndex >= 0) {
        return current.filter((item) => item.library !== selected);
    }

    return [
        ...current,
        {
            library: selected,
            max_concurrent_loans: defaultLimit || "3",
        },
    ];
}

/**
 * Renderiza uma grade de bibliotecas com limite editável por item.
 *
 * @param props Propriedades do componente.
 * @returns Componente visual de grade com campo numérico por biblioteca.
 */
export default function LibraryLimitGrid({
    label,
    helperText,
    error,
    value,
    options,
    defaultLimit,
    emptyDescription,
    onChange,
}: LibraryLimitGridProps) {
    const selectedCount = value.length;

    return (
        <div className="library-limit-field">
            <div className="library-limit-header">
                <label className="field-label">{label}</label>
                <span className="library-limit-count">
                    {selectedCount} {selectedCount === 1 ? "vínculo" : "vínculos"}
                </span>
            </div>

            {helperText && <p className="library-limit-hint">{helperText}</p>}

            {error && <span className="form-field-error">{error}</span>}

            {options.length <= 0 ? (
                <Empty
                    className="library-limit-empty"
                    description={emptyDescription || "Nenhum acervo disponível."}
                />
            ) : (
                <div className="library-limit-grid">
                    {options.map((option) => {
                        const current = value.find((item) => item.library === option.value);
                        const checked = Boolean(current);
                        const currentLimit = current?.max_concurrent_loans || defaultLimit || "3";

                        return (
                            <div
                                key={option.value}
                                className={`library-limit-card${checked ? " is-selected" : ""}`}
                            >
                                <div className="library-limit-card-head">
                                    <div className="library-limit-card-title-wrap">
                                        <span className="library-limit-card-title">{option.label}</span>
                                        <span className="library-limit-card-status">
                                            {checked ? "Vinculado" : "Disponível"}
                                        </span>
                                    </div>
                                    <Switch
                                        checked={checked}
                                        onChange={() => {
                                            onChange(toggleSelection(value, option.value, defaultLimit));
                                        }}
                                    />
                                </div>

                                <div className="library-limit-card-body">
                                    <span className="library-limit-card-label">
                                        Limite de empréstimos simultâneos
                                    </span>
                                    <InputNumber
                                        className="library-limit-input"
                                        min={1}
                                        disabled={!checked}
                                        value={checked ? Number(currentLimit) : null}
                                        onChange={(newValue) => {
                                            const normalized = String(newValue ?? "").trim();
                                            onChange(
                                                value.map((item) =>
                                                    item.library === option.value
                                                        ? {
                                                              library: item.library,
                                                              max_concurrent_loans: normalized,
                                                          }
                                                        : item
                                                )
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
