import { Routes, Route } from "react-router-dom";
import HomeView from "./view/HomeView";
import BookDetailsWrapper from "./view/BookDetailsWrapper";
import SearchView from "./view/SearchView";
import PublisherAdminView from "./view/PublisherAdminView";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/book/:id" element={<BookDetailsWrapper />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/publisher-admin" element={<PublisherAdminView />} />
        </Routes>
    );
}
