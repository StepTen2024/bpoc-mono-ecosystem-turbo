import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/card'
import { Button } from '@/components/shared/ui/button'
import { Mail, Calculator, Linkedin, Target, ArrowRight } from 'lucide-react'

const TOOLS = [
  {
    id: 'email-signature',
    title: 'Email Signature Generator',
    description: 'Create professional email signatures for Gmail and Outlook in seconds',
    icon: Mail,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    href: '/tools/email-signature'
  },
  {
    id: 'salary-calculator',
    title: 'BPO Salary Calculator',
    description: 'Find out what you should be earning based on your experience and skills',
    icon: Calculator,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    href: '/tools/salary-calculator'
  },
  {
    id: 'linkedin-optimizer',
    title: 'LinkedIn Profile Optimizer',
    description: 'Analyze your LinkedIn profile and get tips to attract more recruiters',
    icon: Linkedin,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    href: '/tools/linkedin-optimizer'
  },
  {
    id: 'skills-gap',
    title: 'Skills Gap Analyzer',
    description: 'Discover what skills you need to land your dream BPO job and how to learn them',
    icon: Target,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    href: '/tools/skills-gap'
  }
]

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">
            Free Career Tools
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Professional tools to help you land your dream BPO job. All 100% free.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {TOOLS.map((tool) => {
            const Icon = tool.icon
            return (
              <Card key={tool.id} className="hover:shadow-lg transition-shadow duration-300 border-2 hover:border-cyan-200">
                <CardHeader>
                  <div className={`w-12 h-12 ${tool.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${tool.color}`} />
                  </div>
                  <CardTitle className="text-xl">{tool.title}</CardTitle>
                  <CardDescription className="text-gray-600">
                    {tool.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={tool.href}>
                    <Button className="w-full group">
                      Try it now
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-cyan-600 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Want Access to Premium Features?</h2>
          <p className="text-lg mb-6 text-cyan-50">
            Create a free account to save your results, track your progress, and get personalized job recommendations
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="bg-white text-cyan-600 hover:bg-gray-100">
                Create Free Account
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Browse Jobs
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats/Trust Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12 text-center">
          <div>
            <div className="text-3xl font-bold text-cyan-600 mb-1">4</div>
            <div className="text-sm text-gray-600">Free Tools</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-600 mb-1">100%</div>
            <div className="text-sm text-gray-600">Free Forever</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600 mb-1">2 mins</div>
            <div className="text-sm text-gray-600">Average Time</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-600 mb-1">No Login</div>
            <div className="text-sm text-gray-600">Required</div>
          </div>
        </div>
      </div>
    </div>
  )
}
