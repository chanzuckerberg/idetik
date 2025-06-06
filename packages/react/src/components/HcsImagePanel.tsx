"use client";

import { loadOmeZarrPlate, loadOmeZarrWell } from "@idetik/core";
import { useState, useEffect } from "react";

interface HcsImagePanelProps {
  baseUrl: string;
  well?: string;
  fov?: string;
  onWellChange?: (well: string) => void;
  onFovChange?: (fov: string) => void;
}

/** Controlled component that provides dynamic HCS well and FOV selectors */
export function HcsImagePanel({
  baseUrl,
  well,
  fov,
  onWellChange,
  onFovChange,
}: HcsImagePanelProps) {
  const [wellOptions, setWellOptions] = useState<string[]>([]);
  const [fovOptions, setFovOptions] = useState<string[]>([]);
  const [isLoadingWells, setIsLoadingWells] = useState(false);
  const [isLoadingFovs, setIsLoadingFovs] = useState(false);

  // Load well options from plate metadata
  useEffect(() => {
    const loadWells = async () => {
      setIsLoadingWells(true);
      try {
        const plate = await loadOmeZarrPlate(baseUrl);
        const wells = plate.plate?.wells.map((w) => w.path) || [];
        setWellOptions(wells);
      } catch (error) {
        console.error("Failed to load plate metadata:", error);
        setWellOptions([]);
      } finally {
        setIsLoadingWells(false);
      }
    };

    loadWells();
  }, [baseUrl]);

  // Load FOV options when well changes
  useEffect(() => {
    if (!well) {
      setFovOptions([]);
      return;
    }

    const loadFovs = async () => {
      setIsLoadingFovs(true);
      try {
        const wellData = await loadOmeZarrWell(baseUrl, well);
        const fovs = wellData.well?.images.map((img) => img.path) || [];
        setFovOptions(fovs);
      } catch (error) {
        console.error("Failed to load well metadata:", error);
        setFovOptions([]);
      } finally {
        setIsLoadingFovs(false);
      }
    };

    loadFovs();
  }, [baseUrl, well]);

  return (
    <div>
      <div>
        <label>Well: </label>
        <select
          value={well || ""}
          onChange={(e) => onWellChange?.(e.target.value)}
          disabled={isLoadingWells}
        >
          <option value="">
            {isLoadingWells ? "Loading wells..." : "Select well..."}
          </option>
          {wellOptions.map((wellPath) => (
            <option key={wellPath} value={wellPath}>
              {wellPath}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>FOV: </label>
        <select
          value={fov || ""}
          onChange={(e) => onFovChange?.(e.target.value)}
          disabled={isLoadingFovs || !well}
        >
          <option value="">
            {isLoadingFovs
              ? "Loading FOVs..."
              : !well
                ? "Select well first"
                : "Select FOV..."}
          </option>
          {fovOptions.map((fovPath) => (
            <option key={fovPath} value={fovPath}>
              {fovPath}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
