import { Card, Skeleton } from "antd";
import "../styles/CarouselLoadingState.css";

interface CarouselLoadingStateProps {
    count?: number;
}

/**
 * Exibe um conjunto de cards esqueleto com shimmer para estados de carregamento em carrosséis.
 *
 * @param count Quantidade de placeholders a renderizar.
 * @returns JSX do estado de carregamento do carrossel.
 */
export default function CarouselLoadingState({ count = 4 }: CarouselLoadingStateProps) {
    return (
        <div className="carousel-loading" aria-busy="true" aria-live="polite">
            {Array.from({ length: count }, (_, index) => (
                <Card
                    key={`carousel-loading-${index}`}
                    className="glass-card book-card carousel-loading-card"
                    cover={
                        <div className="book-card-cover carousel-loading-cover">
                            <Skeleton.Image active />
                        </div>
                    }
                >
                    <div className="carousel-loading-meta">
                        <Skeleton active title={{ width: "78%" }} paragraph={{ rows: 2 }} />
                    </div>
                </Card>
            ))}
        </div>
    );
}
