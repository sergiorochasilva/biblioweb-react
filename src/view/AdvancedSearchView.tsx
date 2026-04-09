import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Col, Empty, Input, Layout, Row, Select, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import HeaderView from "./HeaderView";
import BookCard from "../components/BookCard";
import {
    ADVANCED_SEARCH_FIELDS,
    AdvancedSearchFieldKey,
    AdvancedSearchFilters,
    AdvancedSearchOperatorKey,
    AdvancedSearchRule,
    DEFAULT_PUBLIC_LIBRARY_ID,
    fetchAdvancedSearchResults,
    getAdvancedSearchFieldByKey,
    getAdvancedSearchOperationsByFieldType,
} from "../service/BookService";
import { Book } from "../model/Book";
import { useAuth } from "../contexts/AuthContext";
import "../styles/AdvancedSearchView.css";

type RuleRow = AdvancedSearchRule & {
    id: string;
};

function createRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultRule(field: AdvancedSearchFieldKey = "title"): RuleRow {
    const fieldDefinition = getAdvancedSearchFieldByKey(field);
    const operationOptions = getAdvancedSearchOperationsByFieldType(fieldDefinition.type);
    const preferredOperator = operationOptions.some(
        (operation) => operation.key === fieldDefinition.defaultOperator
    )
        ? fieldDefinition.defaultOperator
        : operationOptions[0].key;

    return {
        id: createRuleId(),
        field,
        operator: preferredOperator,
        value: "",
    };
}

export default function AdvancedSearchView() {
    const navigate = useNavigate();
    const { Content } = Layout;
    const { getAccessToken, library } = useAuth();

    const [search, setSearch] = useState("");
    const [rules, setRules] = useState<RuleRow[]>([createDefaultRule()]);
    const [results, setResults] = useState<Book[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const fieldOptions = useMemo(
        () =>
            ADVANCED_SEARCH_FIELDS.map((field) => ({
                value: field.key,
                label: field.label,
            })),
        []
    );

    function addRule() {
        setRules((previous) => [...previous, createDefaultRule()]);
    }

    function removeRule(ruleId: string) {
        setRules((previous) => {
            const next = previous.filter((rule) => rule.id !== ruleId);
            if (next.length > 0) {
                return next;
            }
            return [createDefaultRule()];
        });
    }

    function updateRuleField(ruleId: string, field: AdvancedSearchFieldKey) {
        setRules((previous) =>
            previous.map((rule) => {
                if (rule.id !== ruleId) {
                    return rule;
                }

                const fieldDefinition = getAdvancedSearchFieldByKey(field);
                const operationOptions = getAdvancedSearchOperationsByFieldType(fieldDefinition.type);
                const hasSelectedOperator = operationOptions.some(
                    (operation) => operation.key === rule.operator
                );
                const nextOperator = hasSelectedOperator
                    ? rule.operator
                    : operationOptions.some(
                          (operation) => operation.key === fieldDefinition.defaultOperator
                      )
                    ? fieldDefinition.defaultOperator
                    : operationOptions[0].key;
                const selectedOperator = operationOptions.find(
                    (operation) => operation.key === nextOperator
                );

                return {
                    ...rule,
                    field,
                    operator: nextOperator,
                    value: selectedOperator?.requiresValue ? rule.value || "" : "",
                };
            })
        );
    }

    function updateRuleOperator(ruleId: string, operator: AdvancedSearchOperatorKey) {
        setRules((previous) =>
            previous.map((rule) => {
                if (rule.id !== ruleId) {
                    return rule;
                }

                const fieldDefinition = getAdvancedSearchFieldByKey(rule.field);
                const operationOptions = getAdvancedSearchOperationsByFieldType(fieldDefinition.type);
                const selectedOperation = operationOptions.find(
                    (operation) => operation.key === operator
                );

                return {
                    ...rule,
                    operator,
                    value: selectedOperation?.requiresValue ? rule.value || "" : "",
                };
            })
        );
    }

    function updateRuleValue(ruleId: string, value: string) {
        setRules((previous) =>
            previous.map((rule) =>
                rule.id === ruleId
                    ? {
                          ...rule,
                          value,
                      }
                    : rule
            )
        );
    }

    async function runSearch() {
        setIsSearching(true);
        try {
            const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
            const accessToken = await getAccessToken();

            const normalizedRules = rules
                .map((rule) => {
                    const fieldDefinition = getAdvancedSearchFieldByKey(rule.field);
                    const operation = getAdvancedSearchOperationsByFieldType(
                        fieldDefinition.type
                    ).find((item) => item.key === rule.operator);

                    if (!operation) {
                        return null;
                    }

                    if (!operation.requiresValue) {
                        return {
                            field: rule.field,
                            operator: rule.operator,
                        } as AdvancedSearchRule;
                    }

                    const normalizedValue =
                        typeof rule.value === "string" ? rule.value.trim() : "";
                    if (!normalizedValue) {
                        return null;
                    }

                    return {
                        field: rule.field,
                        operator: rule.operator,
                        value: normalizedValue,
                    } as AdvancedSearchRule;
                })
                .filter((rule): rule is AdvancedSearchRule => rule !== null);

            const requestFilters: AdvancedSearchFilters = {
                search: search.trim(),
                limit: 80,
                rules: normalizedRules,
            };

            const books = await fetchAdvancedSearchResults(
                requestFilters,
                libraryId,
                accessToken || undefined
            );
            setResults(books);
            setHasSearched(true);
        } catch (error) {
            console.error("Failed to run advanced search", error);
            setResults([]);
            setHasSearched(true);
        } finally {
            setIsSearching(false);
        }
    }

    function clearFilters() {
        setSearch("");
        setRules([createDefaultRule()]);
        setResults([]);
        setHasSearched(false);
    }

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <Typography.Title level={3} className="section-title">
                        Busca avançada
                    </Typography.Title>

                    <div className="glass-panel advanced-search-form">
                        <div className="advanced-search-top">
                            <Typography.Text className="advanced-label">
                                Busca geral (opcional)
                            </Typography.Text>
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Ex: Agostinho"
                            />
                        </div>

                        <div className="advanced-rule-list">
                            {rules.map((rule) => {
                                const fieldDefinition = getAdvancedSearchFieldByKey(rule.field);
                                const operationOptions = getAdvancedSearchOperationsByFieldType(
                                    fieldDefinition.type
                                );
                                const selectedOperation = operationOptions.find(
                                    (operation) => operation.key === rule.operator
                                );

                                return (
                                    <div key={rule.id} className="advanced-rule-row">
                                        <Row gutter={[12, 12]} align="bottom">
                                            <Col xs={24} lg={8}>
                                                <Typography.Text className="advanced-label">
                                                    Campo
                                                </Typography.Text>
                                                <Select
                                                    value={rule.field}
                                                    options={fieldOptions}
                                                    onChange={(value) =>
                                                        updateRuleField(
                                                            rule.id,
                                                            value as AdvancedSearchFieldKey
                                                        )
                                                    }
                                                    showSearch
                                                    optionFilterProp="label"
                                                />
                                            </Col>
                                            <Col xs={24} lg={7}>
                                                <Typography.Text className="advanced-label">
                                                    Operação
                                                </Typography.Text>
                                                <Select
                                                    value={rule.operator}
                                                    options={operationOptions.map((operation) => ({
                                                        value: operation.key,
                                                        label: operation.label,
                                                    }))}
                                                    onChange={(value) =>
                                                        updateRuleOperator(
                                                            rule.id,
                                                            value as AdvancedSearchOperatorKey
                                                        )
                                                    }
                                                />
                                            </Col>
                                            <Col xs={24} lg={7}>
                                                <Typography.Text className="advanced-label">
                                                    Valor
                                                </Typography.Text>
                                                {selectedOperation?.requiresValue ? (
                                                    fieldDefinition.type === "enum" &&
                                                    Array.isArray(fieldDefinition.options) ? (
                                                        <Select
                                                            allowClear
                                                            value={rule.value || undefined}
                                                            options={fieldDefinition.options}
                                                            onChange={(value) =>
                                                                updateRuleValue(
                                                                    rule.id,
                                                                    value ? String(value) : ""
                                                                )
                                                            }
                                                            placeholder="Selecione"
                                                        />
                                                    ) : (
                                                        <Input
                                                            value={rule.value || ""}
                                                            type={
                                                                fieldDefinition.type === "number"
                                                                    ? "number"
                                                                    : fieldDefinition.type === "date"
                                                                    ? "date"
                                                                    : "text"
                                                            }
                                                            placeholder="Informe o valor"
                                                            onChange={(event) =>
                                                                updateRuleValue(
                                                                    rule.id,
                                                                    event.target.value
                                                                )
                                                            }
                                                        />
                                                    )
                                                ) : (
                                                    <Input disabled value="Sem valor" />
                                                )}
                                            </Col>
                                            <Col xs={24} lg={2} className="advanced-rule-row-actions">
                                                <Button
                                                    danger
                                                    type="text"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => removeRule(rule.id)}
                                                    aria-label="Remover regra"
                                                />
                                            </Col>
                                        </Row>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="advanced-rule-actions">
                            <Button icon={<PlusOutlined />} onClick={addRule}>
                                Adicionar regra
                            </Button>
                            <Typography.Text type="secondary">
                                As regras são combinadas com AND.
                            </Typography.Text>
                        </div>

                        <div className="advanced-search-actions">
                            <Button onClick={clearFilters}>Limpar</Button>
                            <Button
                                type="primary"
                                onClick={() => {
                                    void runSearch();
                                }}
                                loading={isSearching}
                            >
                                Pesquisar
                            </Button>
                        </div>
                    </div>

                    <div className="advanced-results-section">
                        <Typography.Title level={4} className="section-title">
                            Resultados
                        </Typography.Title>

                        {!hasSearched ? (
                            <div className="grid-empty glass-panel">
                                <Empty description="Adicione regras e execute a busca." />
                            </div>
                        ) : results.length <= 0 ? (
                            <div className="grid-empty glass-panel">
                                <Empty description="Nenhum resultado encontrado." />
                            </div>
                        ) : (
                            <Row gutter={[20, 20]} className="book-results-grid">
                                {results.map((book) => (
                                    <Col key={book.id} xs={24} sm={12} md={8} lg={6}>
                                        <BookCard
                                            book={book}
                                            onClick={() => navigate(`/book/${book.id}`)}
                                        />
                                    </Col>
                                ))}
                            </Row>
                        )}
                    </div>
                </section>
            </Content>
        </Layout>
    );
}
