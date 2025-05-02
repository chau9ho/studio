'use client';

import React, { useEffect, useState } from 'react';

interface Petal {
    id: number;
    style: React.CSSProperties;
}

const FallingSakura: React.FC<{ count?: number }> = ({ count = 15 }) => {
    const [petals, setPetals] = useState<Petal[]>([]);

    useEffect(() => {
        const generatePetals = () => {
            const newPetals: Petal[] = [];
            for (let i = 0; i < count; i++) {
                const size = Math.random() * (15 - 5) + 5; // size between 5px and 15px
                const duration = Math.random() * (10 - 5) + 5; // duration between 5s and 10s
                const delay = Math.random() * 5; // delay up to 5s
                const startX = Math.random() * 100; // start X position across the width
                const drift = `${Math.random() * 60 - 30}vw`; // horizontal drift between -30vw and +30vw
                const rotation = `${Math.random() * 720 - 360}deg`; // rotation between -360deg and +360deg

                newPetals.push({
                    id: i,
                    style: {
                        left: `${startX}vw`,
                        '--size': `${size}px`,
                        '--drift': drift,
                        '--rotation': rotation,
                        animationDuration: `${duration}s`,
                        animationDelay: `${delay}s`,
                    } as React.CSSProperties,
                });
            }
            setPetals(newPetals);
        };

        generatePetals();

        // Optional: Regenerate petals periodically or on some event
        // const interval = setInterval(generatePetals, 10000); // Regenerate every 10 seconds
        // return () => clearInterval(interval);

    }, [count]);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
            {petals.map((petal) => (
                <div key={petal.id} className="sakura-petal" style={petal.style} />
            ))}
        </div>
    );
};

export default FallingSakura;
