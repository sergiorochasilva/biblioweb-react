import { Book } from "../model/Book";

export async function fetchRecentPublications(): Promise<Book[]> {
    // const response = await fetch("https://biblioweb.online:8080/books", {
    //     headers: {
    //         "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIyVkN1VmRFcUdhSmZxYThaQm1kRl8xaE9EZXowTHd3cmNBaXB1TXRTOG1rIn0.eyJleHAiOjE3NDAyNjg2NTMsImlhdCI6MTc0MDI2ODU5MywianRpIjoiYzZmMGJjNTQtNTIyYy00OTg1LTk4ZjUtNTQxYjBjYzlhMmZjIiwiaXNzIjoiaHR0cHM6Ly9iaWJsaW93ZWIub25saW5lOjg0NDMvcmVhbG1zL21hc3RlciIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiI2YjJlNWQ5OC0wNjdlLTQ3OGUtOGVmYi0zYzliNDI5M2YxODUiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJmcm9uZXNpcy1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiZGZjMTMzM2EtYmUxNi00MDk5LWJlM2YtMGVhZWYxZjcwMzBkIiwiYWNyIjoiMSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzLW1hc3RlciIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJzaWQiOiJkZmMxMzMzYS1iZTE2LTQwOTktYmUzZi0wZWFlZjFmNzAzMGQiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlNlcmdpbyBTaWx2YSIsInByZWZlcnJlZF91c2VybmFtZSI6InNlcmdpb3JvY2hhIiwiZ2l2ZW5fbmFtZSI6IlNlcmdpbyIsImZhbWlseV9uYW1lIjoiU2lsdmEiLCJlbWFpbCI6InNlcmdpby5jb25maWRlbmNpYWxAZ21haWwuY29tIn0.BDeva-wS5mHl_Bc-tmi4U50iol_BErib54OuHEGavFWx278XrvWzzCKWAF-Eavmm6nALZ1Cvz5asDEwnKZ3ylBYUz-MaQ6hNYw6tmcM1dZl27VL6prgjSUAIEmJedrrbZ97nAsM9zyG3nT0qaZAbV8sZsFMt9auy4i-As43LWHF0WtBCy6ddL6-af2QXjxLS-qfSTF67a_f9-UuDtINOSn95DYUnH5BxSIzWYLVKevypXCAs0hwvZCuQu2OpoJTwDrOkszXJbfKv6t80Omnra6OC-pdMfskLBN5TOA4XcnY2op6WaFlUvxso1ofPSrKxA7RllLpH3OYt5jx0DXZfbA"
    //     }
    // });
    const response = await fetch("https://biblioweb.online:8080/libraries_books?library=1");
    if (!response.ok) {
        throw new Error("Failed to fetch recent publications");
    }
    const data = await response.json();
    return data.result as Book[];
}


/**
 * Busca detalhes de um livro por ID
 */
export async function fetchBookDetails(id: string): Promise<Book | null> {
    // Se sua API tem um endpoint específico para buscar um livro por ID, use:
    // const response = await fetch(`https://biblioweb.online:8080/books/${id}`);
    // if (response.ok) {
    //     const data = await response.json();
    //     return data as Book;
    // }

    // Se NÃO tiver, busque todos e filtre (menos eficiente, mas funciona para protótipo):
    const allBooks = await fetchRecentPublications();
    const book = allBooks.find(b => String(b.id) === String(id));
    return book || null;
}

export async function fetchSearchResults(query: string): Promise<Book[]> {
    // const response = await fetch("https://biblioweb.online:8080/books", {
    //     headers: {
    //         "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIyVkN1VmRFcUdhSmZxYThaQm1kRl8xaE9EZXowTHd3cmNBaXB1TXRTOG1rIn0.eyJleHAiOjE3NDAyNjg2NTMsImlhdCI6MTc0MDI2ODU5MywianRpIjoiYzZmMGJjNTQtNTIyYy00OTg1LTk4ZjUtNTQxYjBjYzlhMmZjIiwiaXNzIjoiaHR0cHM6Ly9iaWJsaW93ZWIub25saW5lOjg0NDMvcmVhbG1zL21hc3RlciIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiI2YjJlNWQ5OC0wNjdlLTQ3OGUtOGVmYi0zYzliNDI5M2YxODUiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJmcm9uZXNpcy1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiZGZjMTMzM2EtYmUxNi00MDk5LWJlM2YtMGVhZWYxZjcwMzBkIiwiYWNyIjoiMSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzLW1hc3RlciIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJzaWQiOiJkZmMxMzMzYS1iZTE2LTQwOTktYmUzZi0wZWFlZjFmNzAzMGQiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlNlcmdpbyBTaWx2YSIsInByZWZlcnJlZF91c2VybmFtZSI6InNlcmdpb3JvY2hhIiwiZ2l2ZW5fbmFtZSI6IlNlcmdpbyIsImZhbWlseV9uYW1lIjoiU2lsdmEiLCJlbWFpbCI6InNlcmdpby5jb25maWRlbmNpYWxAZ21haWwuY29tIn0.BDeva-wS5mHl_Bc-tmi4U50iol_BErib54OuHEGavFWx278XrvWzzCKWAF-Eavmm6nALZ1Cvz5asDEwnKZ3ylBYUz-MaQ6hNYw6tmcM1dZl27VL6prgjSUAIEmJedrrbZ97nAsM9zyG3nT0qaZAbV8sZsFMt9auy4i-As43LWHF0WtBCy6ddL6-af2QXjxLS-qfSTF67a_f9-UuDtINOSn95DYUnH5BxSIzWYLVKevypXCAs0hwvZCuQu2OpoJTwDrOkszXJbfKv6t80Omnra6OC-pdMfskLBN5TOA4XcnY2op6WaFlUvxso1ofPSrKxA7RllLpH3OYt5jx0DXZfbA"
    //     }
    // });
    const response = await fetch(`https://biblioweb.online:8080/libraries_books?library=1&search=${query}`);
    if (!response.ok) {
        throw new Error("Failed to fetch search results");
    }
    const data = await response.json();
    return data.result as Book[];
}

export async function lendBook(id: string): Promise<void> {
    // Faz a requisição
    const response = await fetch(`https://biblioweb.online:8080/books-loan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "book_id": id, "library": 1 })
    });

    // Trata eventual erro
    if (!response.ok) {
        throw new Error("Failed to fetch search results");
    }

    // Tratando o retorno como um download
    const disposition = response.headers.get('Content-Disposition');
    let filename = disposition?.split(';')[1].trim().split('=')[1];
    filename = filename ? filename : 'book.lcpl';
    filename = filename.replace(/^"+|"+$/g, '');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}
