import { useState } from "react";
import "./App.css";

function App() {
    const [count, setCount] = useState(0);

    return (
        <>
            <h1 className="text-4xl font-bold text-blue-500 underline">
                THE CASE
            </h1>
        </>
    );
}

export default App;
