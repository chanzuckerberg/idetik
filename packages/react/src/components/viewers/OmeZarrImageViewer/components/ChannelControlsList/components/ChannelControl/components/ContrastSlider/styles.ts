import cns from "classnames";

export const MODIFIED_SLIDER_STYLES = {
  className: cns(
    // Hardcode dark mode colors to force dark mode
    // look, no matter what the theme is
    "[&_.MuiSlider-rail]:!bg-[#dfdfdf]", // this is actually the light mode color,
    // it has better contrast with the dark background
    "[&_.MuiSlider-mark]:!bg-[#696969]",
    "[&_.MuiSlider-valueLabelLabel]:!text-white",
    "[&_.MuiSlider-valueLabel]:!bg-[#0D7CB5]" // This is a biohub color,
    // not sure how I can take theme variables from the actual application
    // and use them here
  ),
  sx: {
    // Hacky way to override the thumb circle color to white
    // even in dark mode.
    // Higher specificity selectors to override !important styles
    "&&& .MuiSlider-thumb": {
      "&:after": {
        backgroundColor: "#fff !important",
      },
    },
    // Alternative approach with direct element + class targeting for even higher specificity
    "span.MuiSlider-thumb": {
      "&:after": {
        backgroundColor: "#fff !important",
      },
    },
  },
};
