import type {Metadata} from "next"; import "./globals.css";
export const metadata:Metadata={title:"Kaspa Stratum Manager",description:"Manage local Kaspa solo mining from Umbrel."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
