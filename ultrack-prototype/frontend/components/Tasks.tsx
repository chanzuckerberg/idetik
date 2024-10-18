import { Box } from "@mui/material";
import Task from "./Task";
import { Button } from "@czi-sds/components";

export default function Tasks() {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: "1em",
            }}>
            <h1>Review Cell Divisions</h1>
            <h2>1 of 3 annotations reviewed</h2>
            <Task index={0} complete={true}/>
            <Task index={1} complete={false}/>
            <Task index={2} complete={false}/>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    gap: "1em",
                }}
            >
                <Button sdsStyle="square">Previous</Button>
                <Button sdsStyle="square">Next</Button>
            </Box>
        </Box>
    )
}
