import { InputCheckbox } from "@czi-sds/components";
import { Box } from "@mui/material";

type TaskProps = {
    index: number,
    complete: boolean,
};

export default function Task(props: TaskProps) {
    const { index: taskIndex, complete } = props;
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "row",
            }}>
            <h3>{taskIndex}</h3>
            <h3>Track</h3>
            <InputCheckbox
                stage={complete ? "checked" : "unchecked"}
                disabled={true}
            >
            </InputCheckbox>
        </Box>
    )
}
