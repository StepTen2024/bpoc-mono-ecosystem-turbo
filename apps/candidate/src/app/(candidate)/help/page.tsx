'use client'

import { Scale, Shield, Globe, Phone, Mail, ExternalLink, ChevronRight, Heart, Users, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Help & Your Rights</h1>
        <p className="text-gray-400 mt-2">
          Know your rights as a candidate and find help when you need it.
        </p>
      </div>

      {/* Your Rights */}
      <Card className="bg-gradient-to-br from-cyan-500/10 to-purple-500/5 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20">
              <Scale className="h-5 w-5 text-cyan-400" />
            </div>
            Your Rights as a Candidate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: Shield,
                title: 'Data Privacy',
                description: 'Your personal data is protected. We only share your profile with employers when you apply or give consent.',
              },
              {
                icon: Globe,
                title: 'Equal Opportunity',
                description: 'All candidates are evaluated fairly based on skills and qualifications, regardless of background.',
              },
              {
                icon: FileText,
                title: 'Transparent Process',
                description: 'You have the right to know the status of your applications and receive feedback on decisions.',
              },
              {
                icon: Users,
                title: 'Fair Treatment',
                description: 'You deserve respectful, professional treatment throughout the recruitment process.',
              },
            ].map((item) => (
              <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10">
                    <item.icon className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{item.title}</h3>
                    <p className="text-gray-400 text-xs mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <Heart className="h-5 w-5 text-purple-400" />
            </div>
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              q: 'How do I update my profile?',
              a: 'Go to your Profile page from the sidebar. You can update your personal details, work experience, and skills at any time.',
            },
            {
              q: 'How do I apply for a job?',
              a: 'Browse available jobs from the Jobs page and click "Apply" on any position that interests you.',
            },
            {
              q: 'How can I track my applications?',
              a: 'Visit the My Applications page to see the status of all your submitted applications in real-time.',
            },
            {
              q: 'What happens after I apply?',
              a: 'Your application will be reviewed by our recruitment team. You\'ll receive updates as your application progresses through the hiring pipeline.',
            },
            {
              q: 'Can I withdraw an application?',
              a: 'Yes, you can withdraw any active application from the application details page.',
            },
            {
              q: 'How do interviews work?',
              a: 'When you\'re selected for an interview, you\'ll receive a notification with the schedule and a video call link. Interviews are conducted online.',
            },
          ].map((faq, i) => (
            <details key={i} className="group rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <summary className="flex items-center justify-between p-4 cursor-pointer text-white font-medium text-sm hover:bg-white/5 transition-colors">
                {faq.q}
                <ChevronRight className="h-4 w-4 text-gray-500 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-gray-400 text-sm leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/20">
              <Phone className="h-5 w-5 text-green-400" />
            </div>
            Need More Help?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm mb-4">
            If you have questions or concerns that aren&apos;t covered above, reach out to our support team.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:support@bpoc.io"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors"
            >
              <Mail className="h-4 w-4" />
              support@bpoc.io
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
