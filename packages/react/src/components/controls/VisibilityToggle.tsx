import { IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

interface VisibilityToggleProps {
  visible: boolean;
  onChange: (visible: boolean) => void;
}

export function VisibilityToggle({ visible, onChange }: VisibilityToggleProps) {
  return (
    <IconButton onClick={() => {
      console.log("VisibilityToggle click, toggling from:", visible, "to:", !visible);
      onChange(!visible);
    }}>
      {visible ? <Visibility /> : <VisibilityOff />}
    </IconButton>
  );
}