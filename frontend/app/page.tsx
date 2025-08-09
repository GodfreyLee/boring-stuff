import Navigation from '@/components/Navigation';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Retro grid pattern overlay */}
      <div className="absolute inset-0 opacity-20">
        <div className="h-full w-full" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}></div>
      </div>
      
      <Navigation />
      
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-8">
        <div className="text-center space-y-8">
          <h1 className="text-6xl font-minecraft text-white drop-shadow-lg">
            Work Toolbox
          </h1>
          <p className="text-xl font-minecraft text-gray-300 max-w-2xl">
            Your retro-style workspace for document management and reimbursements
          </p>
          
          {/* Retro-style welcome card */}
          <div className="retro-container bg-gray-800/80 backdrop-blur-sm p-8 max-w-md mx-auto mt-8">
            <h2 className="text-2xl font-minecraft text-white mb-4">Welcome!</h2>
            <p className="font-minecraft text-gray-300 text-sm leading-relaxed">
              Select a tool from the navigation above to get started with your tasks.
            </p>
          </div>
        </div>
        
        {/* Floating retro elements */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-yellow-400 opacity-60 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-6 h-6 bg-pink-400 opacity-60 animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-20 w-5 h-5 bg-cyan-400 opacity-60 animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-10 w-3 h-3 bg-green-400 opacity-60 animate-pulse delay-500"></div>
      </main>
    </div>
  );
}
