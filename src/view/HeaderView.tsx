import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/logo.png";
import "../styles/HeaderView.css";

export default function HeaderView() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("query") || "";
    const [input, setInput] = useState(query);

    /** dispara a navegação para /search?query=... */
    const doSearch = (term: string) => {
        setSearchParams({ query: term });          // ← aqui sim mudamos a URL
        navigate(`/search?query=${term}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") doSearch(input);
    };

    return (
        <>
            <header className="header">
                <img
                    src={logo}
                    alt="BiblioWeb Logo"
                    className="logo-image"
                    onClick={() => navigate("/")}
                />
                <button className="menu-button">☰</button>
            </header>

            {/* barra de busca */}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Procure por: título, autor ou descrição de um livro"
                    className="search-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />

                {/* botão de lupa */}
                <button
                    className="search-button"
                    aria-label="Pesquisar"
                    onClick={() => doSearch(input)}
                >
                    🔍
                </button>
            </div>
        </>
    );
}
