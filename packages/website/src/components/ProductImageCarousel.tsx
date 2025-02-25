import { Box, Button, Container, Modal } from "@cloudscape-design/components";
import { useState } from "react";
import "./carousel.css";

export interface ProductImageCarouselProps {
  imageFiles: File[];
}

const ProductImageCarousel = (props: ProductImageCarouselProps) => {
  const [activeImage, setActiveImage] = useState(0);
  const [zoom, setZoom] = useState(false);

  const rotateImage = (increment: number) => {
    if (props.imageFiles.length > 1) {
      let newIndex = activeImage + increment;
      if (newIndex < 0) {
        newIndex = props.imageFiles.length - 1;
      } else {
        newIndex = newIndex % props.imageFiles.length;
      }
      setActiveImage(newIndex);
    }
  };

  return (
    <Container>
      <Modal
        size="max"
        visible={zoom}
        onDismiss={() => setZoom(false)}
        footer={
          <Box float="right">
            <Button
              variant="primary"
              onClick={(e) => {
                e.preventDefault();
                setZoom(false);
              }}
            >
              Close
            </Button>
          </Box>
        }
      >
        <img
          src={URL.createObjectURL(props.imageFiles[activeImage])}
          alt="product image"
          className="product-image-zoom"
        />
      </Modal>
      <Box variant="div" textAlign="center">
        <div>
          <Button
            variant="inline-icon"
            iconName="expand"
            onClick={(e) => {
              e.preventDefault();
              setZoom(true);
            }}
          />
          <img
            src={URL.createObjectURL(props.imageFiles[activeImage])}
            alt="product image"
            className="product-image"
          />
        </div>

        <div className="pagination">
          <Button
            iconName="angle-left"
            iconAlign="left"
            variant="inline-icon"
            onClick={() => rotateImage(-1)}
          />
          <span>
            {activeImage + 1} / {props.imageFiles.length}
          </span>

          <Button
            iconName="angle-right"
            iconAlign="right"
            variant="inline-icon"
            onClick={() => rotateImage(1)}
          />
        </div>
      </Box>
    </Container>
  );
};

export default ProductImageCarousel;
