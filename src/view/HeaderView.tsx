import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Layout } from "antd";
import { MenuOutlined, SearchOutlined } from "@ant-design/icons";
import logo from "../assets/logo.png";
import "../styles/HeaderView.css";

export default function HeaderView() {
    const { Header } = Layout;
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("query") || "";
    const [input, setInput] = useState(query);

    useEffect(() => {
        setInput(query);
    }, [query]);

    /** dispara a navegação para /search?query=... */
    const doSearch = (term: string) => {
        const normalized = term.trim();
        setSearchParams({ query: normalized });
        navigate(`/search?query=${encodeURIComponent(normalized)}`);
    };

    return (
        <Header className="glass-header">
            <div className="header-inner">
                <Button
                    className="logo-button"
                    type="text"
                    onClick={() => navigate("/")}
                    aria-label="Ir para a página inicial"
                >
                    <img src={logo} alt="BiblioWeb Logo" className="logo-image" />
                </Button>
                <Input.Search
                    placeholder="Procure por: título, autor ou descrição de um livro"
                    className="header-search"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onSearch={doSearch}
                    enterButton={<SearchOutlined />}
                    allowClear
                    size="large"
                />
                <Button
                    className="menu-button"
                    type="text"
                    shape="circle"
                    icon={<MenuOutlined />}
                    aria-label="Abrir menu"
                />
            </div>
        </Header>
    );
}
