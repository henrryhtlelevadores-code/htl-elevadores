"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getClientQuotationsForCopy,
  getQuotationById,
  getQuotationImages,
  type ClientQuotationOption,
  type QuotationDetail,
} from "../actions";
import {
  QuotationCopyPreview,
  QuotationCopyPreviewLoading,
  type QuotationCopyImage,
} from "./quotation-copy-preview";
import { SearchableSelect } from "@/components/ui/searchable-select";

export interface QuotationCopySelection {
  id: string;
  detail: QuotationDetail | null;
  images: QuotationCopyImage[];
}

interface QuotationCopyPickerProps {
  clientId: string;
  selectedId: string;
  targetCostCenterId: string;
  disabled?: boolean;
  onSelectionChange: (selection: QuotationCopySelection) => void;
}

/**
 * Selector de cotizaciones previas del cliente con su vista previa. Vive en un
 * componente con `key` por cliente para que al cambiarlo se reinicie solo.
 */
export function QuotationCopyPicker({
  clientId,
  selectedId,
  targetCostCenterId,
  disabled,
  onSelectionChange,
}: QuotationCopyPickerProps) {
  const [options, setOptions] = useState<ClientQuotationOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [images, setImages] = useState<QuotationCopyImage[]>([]);
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getClientQuotationsForCopy(clientId)
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    return () => {
      requestRef.current += 1;
    };
  }, []);

  function handleSelect(value: string) {
    const requestId = ++requestRef.current;
    onSelectionChange({ id: value, detail: null, images: [] });
    setDetail(null);
    setImages([]);
    if (!value) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    Promise.all([getQuotationById(value), getQuotationImages(value)])
      .then(([quotation, quotationImages]) => {
        if (requestRef.current !== requestId) return;
        if (!quotation) {
          toast.error("No se pudo cargar la cotización seleccionada.");
          onSelectionChange({ id: "", detail: null, images: [] });
          return;
        }
        const mappedImages = quotationImages.map((image) => ({
          id: image.id,
          url: image.url,
          caption: image.caption,
        }));
        setDetail(quotation);
        setImages(mappedImages);
        onSelectionChange({ id: value, detail: quotation, images: mappedImages });
      })
      .catch(() => {
        if (requestRef.current !== requestId) return;
        toast.error("No se pudo cargar la cotización seleccionada.");
        onSelectionChange({ id: "", detail: null, images: [] });
      })
      .finally(() => {
        if (requestRef.current === requestId) setDetailLoading(false);
      });
  }

  return (
    <>
      <SearchableSelect
        items={options}
        value={selectedId}
        onValueChange={handleSelect}
        getValue={(quotation) => quotation.id}
        getLabel={(quotation) => quotation.quotationNumber}
        placeholder={
          optionsLoading ? "Cargando cotizaciones..." : "Selecciona el código de una cotización"
        }
        searchPlaceholder="Buscar por código..."
        emptyText="Este cliente no tiene cotizaciones previas"
        disabled={optionsLoading || disabled}
        allowClear
      />
      {detailLoading ? <QuotationCopyPreviewLoading /> : null}
      {selectedId && detail ? (
        <QuotationCopyPreview
          quotation={detail}
          images={images}
          targetCostCenterId={targetCostCenterId}
          onClear={() => handleSelect("")}
        />
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        Solo aparecen cotizaciones de este cliente. La copia incluye líneas, productos,
        descuentos, mensajes e imágenes.
      </p>
    </>
  );
}
