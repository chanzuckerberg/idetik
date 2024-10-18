import { Box, Typography } from "@mui/material";
import Task, { TaskProps } from "./Task";
import { Button } from "@czi-sds/components";

type TasksProps = {
    tasks: TaskProps[],
};

export default function Tasks(props: TasksProps) {
    const { tasks } = props;
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: "1em",
                margin: "1em",
            }}>
            <Typography variant="h3">Review Cell Divisions</Typography>
            <Typography variant="subtitle1">1 of 3 annotations reviewed</Typography>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                }}
            >
                {tasks.map((t) => <Task key={t.index} index={t.index} complete={t.complete}/> )}
            </Box>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    gap: "1em",
                }}
            >
                <Button sdsType="primary" sdsStyle="square">Previous</Button>
                <Button sdsType="primary" sdsStyle="square">Next</Button>
            </Box>
        </Box>
    )
}
