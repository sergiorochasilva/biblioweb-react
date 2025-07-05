import { Routes, Route } from "react-router-dom";
import HomeView from "./view/HomeView";
import BookDetailsWrapper from "./view/BookDetailsWrapper";
import SearchView from "./view/SearchView";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/book/:id" element={<BookDetailsWrapper />} />
            <Route path="/search" element={<SearchView />} />
        </Routes>
    );
}

