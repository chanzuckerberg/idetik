import { InputCheckbox } from "@czi-sds/components";

export type TaskProps = {
    index: number,
    complete: boolean,
};

export default function Task(props: TaskProps) {
    const { index, complete } = props;
    return (
        <InputCheckbox
            label={(index + 1) + " Track"}
            stage={complete ? "checked" : "unchecked"}
            disabled={complete}
        />
    )
}
