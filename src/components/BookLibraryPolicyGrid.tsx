import { InputNumber, Empty } from "antd";
import type { BookLibraryForm } from "../model/BookLibrary";
import type { LibraryGridSelectorOption } from "./LibraryGridSelector";

export type BookLibraryPolicyGridProps = {
    label: string;
    helperText?: string;
    error?: string;
    value: BookLibraryForm[];
    options?: LibraryGridSelectorOption[];
    emptyDescription?: string;
    onChange: (values: BookLibraryForm[]) => void;
};

/**
 * Atualiza um vínculo de biblioteca no formulário.
 *
 * @param current Vínculos atuais.
 * @param library Biblioteca a ser atualizada.
 * @param field Campo editável da política.
 * @param value Novo valor textual.
 * @returns Lista atualizada de vínculos.
 */
function updateLibraryField(
    current: BookLibraryForm[],
    library: string,
    field: "available_licenses" | "max_uses_per_license",
    value: string
): BookLibraryForm[] {
    const target = library.trim();
    return current.map((item) =>
        item.library.trim() === target ? { ...item, [field]: value } : item
    );
}

/**
 * Renderiza a política de empréstimo por acervo do livro.
 *
 * @param props Propriedades do componente.
 * @returns Componente visual para editar política por biblioteca.
 */
export default function BookLibraryPolicyGrid({
    label,
    helperText,
    error,
    value,
    options = [],
    emptyDescription,
    onChange,
}: BookLibraryPolicyGridProps) {
    const labelMap = new Map(options.map((option) => [option.value, option] as const));

    return (
        <div className="library-limit-field">
            <div className="library-limit-header">
                <label className="field-label">{label}</label>
                <span className="library-limit-count">
                    {value.length} {value.length === 1 ? "acervo" : "acervos"}
                </span>
            </div>

            {helperText && <p className="library-limit-hint">{helperText}</p>}

            {error && <span className="form-field-error">{error}</span>}

            {value.length <= 0 ? (
                <Empty
                    className="library-limit-empty"
                    description={emptyDescription || "Nenhum acervo selecionado."}
                />
            ) : (
                <div className="library-limit-grid">
                    {value.map((item) => {
                        const option = labelMap.get(item.library);
                        const title = option?.label || `Biblioteca #${item.library}`;
                        const subtitle = option?.description;
                        const accumulatedUses = item.license_uses_count || "0";

                        return (
                            <div key={item.id ?? item.library} className="library-limit-card">
                                <div className="library-limit-card-head">
                                    <div className="library-limit-card-title-wrap">
                                        <span className="library-limit-card-title">{title}</span>
                                        <span className="library-limit-card-status">
                                            Política individual do acervo
                                        </span>
                                        {subtitle && (
                                            <span className="library-limit-card-subtitle">
                                                {subtitle}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="library-limit-card-body">
                                    <div className="book-library-policy-field">
                                        <span className="library-limit-card-label">
                                            Licenças disponíveis
                                        </span>
                                        <InputNumber
                                            className="library-limit-input"
                                            min={0}
                                            value={Number(item.available_licenses || 0)}
                                            onChange={(newValue) => {
                                                onChange(
                                                    updateLibraryField(
                                                        value,
                                                        item.library,
                                                        "available_licenses",
                                                        String(newValue ?? "")
                                                    )
                                                );
                                            }}
                                        />
                                    </div>

                                    <div className="book-library-policy-field">
                                        <span className="library-limit-card-label">
                                            Máx. usos por licença
                                        </span>
                                        <InputNumber
                                            className="library-limit-input"
                                            min={1}
                                            value={Number(item.max_uses_per_license || 0)}
                                            onChange={(newValue) => {
                                                onChange(
                                                    updateLibraryField(
                                                        value,
                                                        item.library,
                                                        "max_uses_per_license",
                                                        String(newValue ?? "")
                                                    )
                                                );
                                            }}
                                        />
                                    </div>

                                    <div className="book-library-policy-field">
                                        <span className="library-limit-card-label">
                                            Progresso da licença atual
                                        </span>
                                        <span className="book-library-policy-readonly">
                                            {accumulatedUses}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
