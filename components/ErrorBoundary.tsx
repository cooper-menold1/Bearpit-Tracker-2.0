import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
}

// A stale tab trying to lazy-load a chunk from a since-replaced deploy throws
// "Failed to fetch dynamically imported module" / "error loading dynamically
// imported module" -- with no boundary, React just unmounts to a blank white
// screen. Reloading once picks up the current deploy's chunk map and clears
// it; the sessionStorage guard stops a real, persistent error from reload-looping.
export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        const isChunkLoadError = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error.message);
        const reloadedKey = 'bp_chunk_reload_attempted';

        if (isChunkLoadError && !sessionStorage.getItem(reloadedKey)) {
            sessionStorage.setItem(reloadedKey, '1');
            window.location.reload();
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div role="alert" className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border-t-4 border-[#154734]">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
                        <p className="text-gray-600 mb-6">This page hit an error. Reloading usually fixes it.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-[#154734] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#0f3325] transition-colors"
                        >
                            Reload
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
