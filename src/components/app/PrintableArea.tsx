'use client';

import React from 'react';

interface PrintableAreaProps {
    finalFramedImage: string | null;
    animalName: string;
}

const PrintableArea: React.FC<PrintableAreaProps> = ({ finalFramedImage, animalName }) => {
    if (!finalFramedImage) {
        return null;
    }

    return (
        <div className="hidden printable-area">
            {/* Ensure image has explicit width/height or uses CSS for print sizing */}
            <img
                src={finalFramedImage}
                alt={`Printable framed photo of ${animalName}`}
                // Optionally add width/height attributes or rely on CSS
                // width={1410}
                // height={2250}
                />
        </div>
    );
};

export default PrintableArea;
