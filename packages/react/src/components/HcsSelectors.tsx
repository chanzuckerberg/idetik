import { useEffect, useState } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';

import {
  loadOmeZarrPlate,
  loadOmeZarrWell,
  OmeNgffImage,
  OmeNgffWell,
} from "@idetik/core";

interface HcsSelectorsProps {
  url: string;
  setImagePath: (url: string | null) => void;
}

const nullOption = "";

export function HcsSelectors(props: HcsSelectorsProps) {

  const [wells, setWells] = useState<string[]>([nullOption]);
  const [images, setImages] = useState<string[]>([nullOption]);
  const [selectedWell, setSelectedWell] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchWells = async () => {
      const plate = await loadOmeZarrPlate(props.url);
      const wellPaths = plate.plate.wells.map((well: OmeNgffWell) => well.path);
      setWells([nullOption, ...wellPaths]);
      setSelectedWell(nullOption);
    };
    fetchWells();
  }, [props.url]);

  useEffect(() => {
    const fetchImages = async () => {
      if (!selectedWell) return;
      const well = await loadOmeZarrWell(props.url, selectedWell);
      const imagePaths = well.well.images.map((image: OmeNgffImage) => image.path);
      setImages([nullOption, ...imagePaths]);
      setSelectedImage(nullOption);
    }
    fetchImages();
  }, [props.url, wells, selectedWell]);

  if (selectedWell === nullOption || selectedImage === nullOption) {
    props.setImagePath(null);
  } else {
    props.setImagePath(`${selectedWell}/${selectedImage}`);
  }

  return (
    <Box sx={{ display: 'flex', gap: '1em', mb: 2 }}>
      <Selector
        label="Well"
        options={wells}
        value={selectedWell ?? nullOption}
        onChange={setSelectedWell}
        disabled={wells.length === 0}
      />
      <Selector
        label="Image"
        options={images}
        value={selectedImage ?? nullOption}
        onChange={setSelectedImage}
        disabled={images.length === 0}
      />
    </Box>
  );
}

interface SelectorProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string, index: number) => void;
  disabled?: boolean;
}

function Selector({ label, options, value, onChange, disabled = false }: SelectorProps) {
  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    const index = options.indexOf(value);
    onChange(value, index);
  };

  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel id={`${label.toLowerCase()}-select-label`}>{label}</InputLabel>
      <Select
        labelId={`${label.toLowerCase()}-select-label`}
        id={`${label.toLowerCase()}-select`}
        value={value}
        label={label}
        onChange={handleChange}
      >
        {options.map((option, index) => (
          <MenuItem key={index} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
