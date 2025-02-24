import { Button, Icon } from "@czi-sds/components";

interface VisibilityToggleProps {
  visible: boolean;
  onChange: (visible: boolean) => void;
}

export function VisibilityToggle({ visible, onChange }: VisibilityToggleProps) {
  return (
    <Button
      onClick={() => onChange(!visible)}
      sdsStyle="minimal"
      sdsType="secondary"
    >
      {visible ? <Icon sdsIcon="EyeOpen" sdsSize="s" /> : <Icon sdsIcon="EyeClosed" sdsSize="s" />}
    </Button>
  );
}
